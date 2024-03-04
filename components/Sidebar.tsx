import React, { useEffect, useState, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import styles from '@/styles/Sidebar.module.css';
import { useRouter } from 'next/router';
import axios from 'axios'; 
import MessageLimitModal from './MessageLimitModal';





type ChatSession = {
    _id: string;
    sessionID: string;
    name: string;
    date: string;
};

interface ProfilePopupProps {
  userID: string | null;
}


type SidebarProps = {
    className?: any;
    onSessionChange?: (sessionId: string) => void;
    sessions?: ChatSession[];
    onNewChat?: (newChatSession: string) => void;
};

const CancelConfirmationModal = ({ onClose, message }) => {
  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContainer}>
        <div className={styles.modalHeader}>
          <button onClick={onClose} className={styles.closeButton}>X</button>
        </div>
        <div className={styles.modalContent}>
          {message}
        </div>
        <div className={styles.modalFooter}>
          <button onClick={onClose} className={styles.modalButton}>Close</button>
        </div>
      </div>
    </div>
  );
};


const Sidebar: React.FC<SidebarProps> = ({ className, onSessionChange, sessions, onNewChat }) => {
    const [chatSessions, setChatSessions] = useState<ChatSession[]>(sessions || []);
    const [currentSessionID, setCurrentSessionID] = useState<string | null>(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('sapp');
        }
        return null;
    });
    const [userID, setUserID] = useState(null);
    const [isModalVisible, setIsModalVisible] = useState(false);

    const handleModalVisibility = (visible) => {
        setIsModalVisible(visible);
    };


  

    const [isCreatingSession, setIsCreatingSession] = useState(false);
    const [showPopup, setShowPopup] = useState(false);
    const router = useRouter();
    const [bottomSectionHeight, setBottomSectionHeight] = useState(0); // State for the height of the bottom section
    const bottomSectionRef = useRef(null); // Ref for the bottom section

    const [showCancelConfirmationModal, setShowCancelConfirmationModal] = useState(false);
    const [confirmationMessage, setConfirmationMessage] = useState('');

  //   useEffect(() => {
  //     // ... (existing useEffect logic)
  //     // Additional logic to calculate bottom section height
  //     if (bottomSectionRef.current) {
  //         setBottomSectionHeight(bottomSectionRef.current.offsetHeight);
  //     }
  // }, [bottomSectionRef, isSidebarOpen]); 
  const fetchUserInfo = async () => {
    try {
        const response = await fetch('/api/userInfo');
        const data = await response.json();
        if (data.email) {
            return data.email;
        } else {
            console.error('User info not found');
            return null;
        }
    } catch (error) {
        console.error('Error fetching user info:', error);
        return null;
    }
  };

  useEffect(() => {
    const getUserInfo = async () => {
        const userEmail = await fetchUserInfo();
        setUserID(userEmail); // Set the userID state with the fetched email on mount
    };
    getUserInfo();
  }, []);

    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

    // Function to toggle sidebar
    const toggleSidebar = () => {
        setIsSidebarOpen(!isSidebarOpen);
    };






    



    const ProfilePopup: React.FC<ProfilePopupProps> = ({ userID }) => {
      const router = useRouter();
      const [isLoading, setIsLoading] = useState(false);
      const [isCancelled, setIsCancelled] = useState(false); // New state for tracking cancellation success
    
      const handleLogOut = () => {
        router.push('/'); // Navigate to the home page
      };
    
      const handleCancelSubscription = async () => {
        setIsLoading(true);
        try {
          const response = await fetch('/api/cancelSubscriptionButton', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ userID: userID })
          });
    
          const responseData = await response.json();

          if(responseData.message === 'Subscription canceled successfully'){

            setIsCancelled(true); // Update to reflect cancellation status
            setShowCancelConfirmationModal(true);
          }
    
        } catch (error) {
          console.error('Error canceling subscription:', error);
        }
        setIsLoading(false);
      };
      
      
      const handleClosePopup = () => {
        setShowPopup(true); // This will hide the popup
      };

    
      return (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContainer}>
            <div className={styles.modalHeader}>
              <button onClick={handleClosePopup} className={styles.closeButton}>🆇</button>
            </div>
            <div className={styles.modalButtonContainer}>
              <button onClick={handleLogOut} className={styles.modalButton}>Log Out</button>
              <button 
              onClick={handleCancelSubscription} 
              className={styles.modalButton}
              disabled={isLoading || isCancelled}>

              {isLoading ? 'Loading...' : isCancelled ? '✔️' : 'Cancel Subscription'}
              </button>
            </div>
          </div>
        </div>
      );
    };




    

    const togglePopup = () => {
      setShowPopup(!showPopup);
    };
    







    const getSessionName = () => {
      const now = new Date();
      return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit'});
    };

    const sessionsByDate = chatSessions.reduce((acc, session) => {
        const dateStr = new Date(session.date).toLocaleDateString();
        if (!acc[dateStr]) {
          acc[dateStr] = [];
        }
        acc[dateStr].push(session);
        return acc;
      }, {} as Record<string, ChatSession[]>);
    
      // Sort dates
      const sortedDates = Object.keys(sessionsByDate).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
    
      //function for fetching chat sessions using the user's email and courfetchChatSessionsse
      async function fetchChatSessions(userID) {
          try {
              const response = await fetch('/api/fetchAllSessions', {
                  method: 'POST',
                  headers: {
                      'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                      userID: userID,
                      course: className,
                  }),
              });
              const data = await response.json();
              if (data.sessions === false && !isCreatingSession) {
                  console.log('No sessions found, creating a new one...');
                  setIsCreatingSession(true);
                  handleNewChat();
              } else {
                  setChatSessions(data.sessions || []);
                  // Ensure that the current session is valid
                  if (!data.sessions.find(session => session.sessionID === currentSessionID)) {
                      const newCurrentSessionID = data.sessions[0]?.sessionID || null;
                      localStorage.setItem('sapp', newCurrentSessionID);
                      setCurrentSessionID(newCurrentSessionID);
                      if (onSessionChange && newCurrentSessionID) {
                          onSessionChange(newCurrentSessionID);
                      }
                  }
              }
          } catch (error) {
              console.error('Failed to fetch chat sessions:', error);
          }
      }
      //when userID or other dependencies are updated this function the fetch sessions function
      useEffect(() => {
        async function getUserInfoAndFetchSessions() {
            if (!userID) {
                const userEmail = await fetchUserInfo();
                if (userEmail) {
                    setUserID(userEmail);
                    fetchChatSessions(userEmail);
                }
            } else {
                fetchChatSessions(userID);
            }
        }
        getUserInfoAndFetchSessions();
    }, [currentSessionID, sessions, className, userID]);

    //initializes the UI with a session instantly

    const initNewChat = async () => {
      const newSessionID = uuidv4();
      const sessionName = getSessionName(); 
      setIsCreatingSession(true);
        try {
            const response = await fetch('/api/createNewChatSession', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    userID: userID,
                    sessionID: newSessionID,
                    course: className,
                    name: sessionName,
                }),
            });
            const sessionDate = await response.json();
            localStorage.setItem('sapp', newSessionID);
            setCurrentSessionID(newSessionID);
            setChatSessions(prevSessions => [...prevSessions, { _id: newSessionID, sessionID: newSessionID, name: "Default Name", date: sessionDate.date}]);
            if (onNewChat) {
                onNewChat(newSessionID);
            }
        } catch (error) {
            console.error('Failed to create new chat session:', error);
        }
        setIsCreatingSession(false);
    }

    const handleNewChat = async () => {
      const response = await fetch('/api/checkForNewSessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userID, sessionID: currentSessionID, course: className }),
      });
      const newSession = await response.json();

      if (!newSession.exists) {
        const newSessionID = uuidv4();
        const sessionName = getSessionName(); // Get the session name based on current time
    
        try {
          const response = await fetch('/api/createNewChatSession', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              userID: userID,
              sessionID: newSessionID,
              course: className,
              name: sessionName, // Send the session name to the server
            }),
          });
          const sessionDate = await response.json();
          localStorage.setItem('sapp', newSessionID);
          setCurrentSessionID(newSessionID);
          setChatSessions(prevSessions => [...prevSessions, { _id: newSessionID, sessionID: newSessionID, name: sessionName, date: sessionDate.date }]);
          if (onNewChat) {
            onNewChat(newSessionID);
          }
        } catch (error) {
          console.error('Failed to create new chat session:', error);
        }
      }
      else{
        const idOfEmptySession = newSession.sessionID;
        localStorage.setItem('sapp', idOfEmptySession);
        setCurrentSessionID(idOfEmptySession);
        if (onNewChat) {
          onNewChat(idOfEmptySession);
        }
      }
        
    }

    const handleDeleteSession = async (sessionId: string | null) => {
        // Use window.confirm to display the confirmation dialog

        if (chatSessions.length <= 1) {
            alert("You must have at least one conversation!");
            return;
        }

        const isConfirmed = window.confirm('This conversation will be deleted');
      
        // If the user clicks 'OK', proceed with the deletion
        if (isConfirmed && sessionId) {
          console.log(`Delete session with ID: ${sessionId}`);
          const response = await fetch('/api/deleteSession', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ sessionID: sessionId, className }), // Make sure you pass the correct sessionID to delete
          });
          if (response.ok) {
            // If the delete operation was successful, update the state to remove the session
            setChatSessions(prevSessions => prevSessions.filter(session => session.sessionID !== sessionId));
            const latestSessionResponse = await fetch('/api/getLatestSess', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    course: className, // Assuming 'className' holds the course title
                    userID: userID, // Pass the current user's ID
                }),
            });
            if (latestSessionResponse.ok) {
                const latestSessionData = await latestSessionResponse.json();
                localStorage.setItem('sapp', latestSessionData.sessionID);
                setCurrentSessionID(latestSessionData.sessionID);
                if (onNewChat) {
                    onNewChat(latestSessionData);
                  }
            } else {
                console.error('Failed to fetch the latest session.');
            }
          } else {
            // If there was an error, you can handle it here
            console.error('Failed to delete the session.');
          }
        } else {
          // If the user clicks 'Cancel', do nothing
          console.log('Deletion cancelled.');
        }
        
        
        
      };
      
      



    return (
        <div>


            {showCancelConfirmationModal && (
              <CancelConfirmationModal
                message={"Subscription Has Been Canceled"}
                onClose={() => setShowCancelConfirmationModal(false)}
              />
            )}


        <div className={styles.side} >
        <button onClick={handleNewChat} className={styles.newChatButton}>
          
  New Chat
  <img src="/chat.png" alt="Chat" className={styles.chatIcon} />
</button>
            {sortedDates.map(date => (
                <div key={date}>
                    <h3 className={styles.dateHeading}>{date}</h3>
                    {sessionsByDate[date].map(session => (
                        <div key={session._id} className={styles.sessionContainer}>
                            <button
                                onClick={() => {
                                    localStorage.setItem('sapp', session.sessionID);
                                    setCurrentSessionID(session.sessionID);
                                    if (onSessionChange) {
                                        onSessionChange(session.sessionID);
                                    }
                                }}
                                className={`${styles.sessionButton} ${session.sessionID === currentSessionID ? styles.activeSessionButton : ''}`}
                            >
                                <span className={styles.sessionName}>{session.name}</span>
                                <span 
                                    onClick={(e) => {
                                        e.stopPropagation(); // Prevent the session button's click event
                                        handleDeleteSession(session.sessionID);
                                    }}
                                    className={styles.trashCan}>
                                    𝘅
                                </span>
                            </button>
                        </div>
                    ))}
                </div>
            ))}
            {/* Add the new section here */}
            <div className={styles.bottomSection}>



            <button className={styles.bottomButton}>
    <img 
        src="/discord.png" 
        alt="Discord" 
        className={styles.discordIcon} 
        onClick={() => window.open('https://discord.gg/3V2RhTZWF8', '_blank')}
    />
    <img 
        src="/Instagram1.png" 
        alt="Instagram" 
        className={styles.instagramIcon} 
        onClick={() => window.open('https://www.instagram.com/cornell.gpt/', '_blank')}
    />
    <img 
        src="/gmail.png" 
        alt="Gmail" 
        className={styles.gmailIcon} 
        onClick={() => window.open('mailto:cornellgpt@gmail.com')}
    />
</button>






                
{/* <button className={styles.bottomButton} onClick={togglePopup}>
                  <img src="/logout.png" alt="Log Out" className={styles.logoutIcon} />
                  <span className={styles.logoutText}>Profile</span>
                  {showPopup && <ProfilePopup userID={userID} />}
                </button> */}
                
            </div>
        </div>
        
    </div>
); 
                                  }






export default Sidebar;
