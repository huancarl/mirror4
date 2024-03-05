import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import styles from '@/styles/courseSelection.module.css';
import CourseBox from 'components/CourseBox';
import { v4 as uuidv4 } from 'uuid';
import {withSession, isAuthenticated} from 'utils/session';
import ClassCodeModal from 'components/classCodeModal';
import * as path from 'path';
import { useRouter } from 'next/router';

//Make sure that the page cannot be accessed without logging in
export const getServerSideProps = withSession(async ({ req, res }) => {
  const user = await isAuthenticated(req);

  if (!user) {
      return {
          redirect: {
              destination: '/loginEmail', // Redirect to the sign-in page
              permanent: false,
          },
      };
  }

  // User is authenticated
  return { props: { user } };
});

function CourseCatalog() {

  const [referralLink, setReferralLink] = useState('');
  const userIDRef = useRef<string | null>(null);
  //Enter class code modal
  const [isClassCodeModalVisible, setIsClassCodeModalVisible] = useState(false);
  //Handles entering a class code
  const [classCode, setClassCode] = useState('');
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [courseCodeMapping, setCourseCodeMapping] = useState({});
  const [unlockedClasses, setUnlockedClasses] = useState<string[]>([]);
  const [finishFetching, setFinishFetching] = useState(false);

  const router = useRouter();
  //Logic for handling the course box clicks
  const handleCourseClick = (course) => {
    setSelectedCourse(course);
    if(courseCodeMapping.hasOwnProperty(course)){
      setIsClassCodeModalVisible(true);
    }
  };

  //Get the unlocked classes for the user
  const fetchUnlockedClasses = async () => {
    try {

      const sessionRes = await fetch('/api/userInfo');
      const sessionData = await sessionRes.json();
      if (sessionRes.ok) {
        // Set userID to the user's email from the session
        userIDRef.current = sessionData.email;
      } else {
        // Handle the case where the session is not available
        console.error('Session not found:', sessionData.error);
        return;
      }


      const response = await fetch('/api/getUnlockedClasses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userID: userIDRef.current,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        
        setUnlockedClasses(data.unlockedClasses);
      } else {
        // Handle HTTP error responses
        console.error('Error fetching unlocked classes');
      }
    } catch (error) {
      console.error('Network or other error', error);
    }
  };

  useEffect(() => {
    fetchUnlockedClasses();
    setFinishFetching(true);
  }, []);


  useEffect(() => {
    // This code runs when selectedCourse changes
    

    if (selectedCourse && Array.isArray(unlockedClasses) && unlockedClasses.includes(selectedCourse)) {
      setIsClassCodeModalVisible(false);
      router.push(`/chatbot?course=${selectedCourse}`);
    }

    if (selectedCourse && !(courseCodeMapping.hasOwnProperty(selectedCourse))) {
      router.push(`/chatbot?course=${selectedCourse}`);
    }
  }, [selectedCourse, unlockedClasses]);

  const handleCloseModal = () => {
    setIsClassCodeModalVisible(false);
  };  

  async function verifyClassCode() {

    //If there isn't a code set yet for the class
    if(selectedCourse && !(selectedCourse in courseCodeMapping)){
      router.push(`/chatbot?course=${selectedCourse}`);
    }

    if(selectedCourse && classCode === courseCodeMapping[selectedCourse][0]){
      router.push(`/chatbot?course=${selectedCourse}`);
      const sessionRes = await fetch('/api/userInfo');
      const sessionData = await sessionRes.json();
      if (sessionRes.ok) {
        // Set userID to the user's email from the session
        userIDRef.current = sessionData.email;
      } else {
        // Handle the case where the session is not available
        console.error('Session not found:', sessionData.error);
        return;
      }

      //Update the database to give the class to the user after they enter the code
      const response = await fetch('/api/updateUnlockedClasses', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            userID: userIDRef.current,
            className: selectedCourse,
        })
      });


    }
    setIsClassCodeModalVisible(false);

  }

  async function fetchClassCodes () {

    const classCodesResponse = await fetch('/api/fetchCourseCodes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
      }),
    });

    const classCodeMap = await classCodesResponse.json();
    // class code map is a mapping from class code (CS 1110) to a 5 digit code (12345)
    setCourseCodeMapping(classCodeMap.mapping);
  }

  useEffect (() => {
    fetchClassCodes();
  }, [])


  function getOrGenerateUUID(key: string): string {
    let value = localStorage.getItem(key) || '';
    if (!value) {
        value = uuidv4();
        localStorage.setItem(key, value);
    }
    return value;
  }

  const [isPopupVisible, setIsPopupVisible] = useState(false);

  const handleReferralClick = () => {
    setIsPopupVisible(true);

  };


  useEffect(() => {
    const fetchOrCreateRef = async() => {

      const sessionRes = await fetch('/api/userInfo');
        const sessionData = await sessionRes.json();
        if (sessionRes.ok) {
            // Set userID to the user's email from the session
            const userID = sessionData.email;
            let link = "https://gptcornell.com/sign-up?referralCode=";
  
            let response = await fetch('/api/fetchOrCreateReferral', {
              method: 'POST',
              headers: {
                  'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                  userID,
              }),
            });
            const data = await response.json();
            if(data){
              link = link + data.code;
              setReferralLink(link);
            }
        } else {
            // Handle the case where the session is not available
            console.error('Session not found:', sessionData.error);
            return;
        }
    }
    fetchOrCreateRef();
  }, []);

  

const courses = [
 
  { 
    key: 'CS 4780', 
    namespaceTitle: 'CS 4780', 
    displayTitle: 'CS 4780/ CS 5780', 
    professor: 'Machine Learning, Professor Weinberger & Sridharan' 
  },

  { 
    key: "CS 2110", 
    namespaceTitle: "CS 2110",
    displayTitle: "CS 2110", 
    professor: 'OOP & Data Structures, Professor Muhlberger' 
  },

  { 
    key: 'INFO 1260', 
    namespaceTitle: 'INFO 1260', 
    displayTitle: 'INFO 1260/CS 1340', 
    professor: 'Conseq. Of Computing, Professor Kleinberg & Levy' 
  },


  { 
    key: 'AEM 2601', 
    namespaceTitle: 'AEM 2601', 
    displayTitle: 'AEM 2601', 
    professor: 'Strategy, Professor Preuss & Wu' 
  },

  { 
    key: 'AEM 2240', 
    namespaceTitle: 'AEM 2240', 
    displayTitle: 'AEM 2240', 
    professor: 'Finance for Dyson Majors, Professor Addoum' 
  },
  { 
    key: "PLSCI 2013", 
    namespaceTitle: 'PLSCI 2013', 
    displayTitle: "PLSCI 2013/ PLSCI 2010", 
    professor: 'Mushrooms, Professor Hodge' 
  },

  { 
    key: "CS 1110", 
    namespaceTitle:  "CS 1110", 
    displayTitle: "CS 1110", 
    professor: 'Intro To Computing, Professor Bracy' 
  },

  { 
    key: "MATH 2220", 
    namespaceTitle:  "MATH 2220", 
    displayTitle: "MATH 2220", 
    professor: 'Multivariable Calc, Professor Dozier' 
  },


  { 
    key: "HD 3620", 
    namespaceTitle: "HD 3620",
    displayTitle: "HD 3620", 
    professor: 'Human Bonding, Professor Hazan' 
  },

  { 
    key: "AEM 3000", 
    namespaceTitle: "AEM 3000",
    displayTitle: "AEM 3000", 
    professor: 'Working Together. Professor Sauer & Wolfolds' 
  },


  { 
    key: "BTRY 3020", 
    namespaceTitle:  "BTRY 3020", 
    displayTitle: "BTRY 3020/ BTRY 5020 STSCI 3200/ STSCI 5201", 
    professor: 'Biological Statistics 2, Professor Entner' 
  },



  { 
    key: 'ENGL 2800', 
    namespaceTitle: 'ENGL 2800', 
    displayTitle: 'ENGL 2800 (SEM 108)', 
    professor: 'Creative Writing, Professor Makridi' 
  },

  { 
    key: 'INFO 4390', 
    namespaceTitle: 'INFO 4390', 
    displayTitle: 'INFO 4390/ INFO 5390/ CS 5382', 
    professor: 'Fair Algorithms, Professor Koenecke' 
  },
  { 
    key: 'PLSCI 1150', 
    namespaceTitle: 'PLSCI 1150', 
    displayTitle: 'PLSCI 1150', 
    professor: 'CSI: Forensic Botany, Professor Crepet' 
  },
  { 
    key: 'INFO 4300', 
    namespaceTitle: 'INFO 4300', 
    displayTitle: 'INFO 4300/ CS 4300', 
    professor: 'Language & Information, Professor Danescu-Niculescu-Mizil' 
  },
  { 
    key: 'INFO 4100', 
    namespaceTitle: 'INFO 4100', 
    displayTitle: 'INFO 4100/ INFO 5101', 
    professor: 'Learning Analytics, Professor Rene Kizilcec' 
  },



  { 
    key: 'AEM 4140', 
    namespaceTitle: 'AEM 4140', 
    displayTitle: 'AEM 4140', 
    professor: 'Behavioral Econ, Professor Fisher' 
  },


  { 
    key: "GOVT 3161", 
    namespaceTitle: "GOVT 3161", 
    displayTitle: "GOVT 3161", 
    professor: 'The American Presidency, Professor Kriner' 
  },

  { 
    key: "GDEV 1200", 
    namespaceTitle: "GDEV 1200", 
    displayTitle: "GDEV 1200 FWS", 
    professor: 'Topics In Global Dev, Professor LeBeau' 
  },

  { 
    key: "AEM 3030", 
    namespaceTitle: "AEM 3030", 
    displayTitle: "AEM 3030", 
    professor: 'Explorations in Analytic Modeling, Professor Haeger' 
  },

  { 
    key: "SOC 3580", 
    namespaceTitle: "SOC 3580", 
    displayTitle: "SOC 3580", 
    professor: 'Big Data on the Social World, Professor Young' 
  },

  { 
    key: "MAE 3240", 
    namespaceTitle: "MAE 3240", 
    displayTitle: "MAE 3240", 
    professor: 'Heat Transfer, Professor Avedisian' 
  },

  //sdajsdisdj

  { 
    key: "INFO 4940", 
    namespaceTitle: "INFO 4940", 
    displayTitle: "INFO 4940", 
    professor: 'U.S. Copyright Laws, Professor Priehs' 
  },

  { 
    key: "HADM 4200", 
    namespaceTitle: "HADM 4200", 
    displayTitle: "HADM 4200", 
    professor: 'Principles of Real Estate, Professor Kytomaa' 
  },

  { 
    key: "HADM 2230", 
    namespaceTitle: "HADM 2230", 
    displayTitle: "HADM 2230", 
    professor: 'Financial Accounting Principles, Professor Geiszler'
  },

  { 
    key: "ENGRD 2700", 
    namespaceTitle: "ENGRD 2700", 
    displayTitle: "ENGRD 2700", 
    professor: 'Basic Engineering Probability and Statistics, Professor Wissel'
  },

  { 
    key: "AEM 2210", 
    namespaceTitle: "AEM 2210", 
    displayTitle: "AEM 2210", 
    professor: 'Financial Accounting, Professor Szpiro'
  },

  { 
    key: "MAE 3780", 
    namespaceTitle: "MAE 3780", 
    displayTitle: "MAE 3780", 
    professor: 'Mechatronics, Professor Nunez'
  },

  { 
    key: "CS 4700", 
    namespaceTitle: "CS 4700", 
    displayTitle: "CS 4700", 
    professor: 'Foundations of AI, Professor Ellis'
  },

  { 
    key: "INFO 4220", 
    namespaceTitle: "INFO 4220", 
    displayTitle: "INFO 4220", 
    professor: 'Networks II: Market Design, Professor Cheyre Forestier'
  },

  { 
    key: "MUSIC 1312", 
    namespaceTitle: "MUSIC 1312", 
    displayTitle: "MUSIC 1312", 
    professor: 'History of Rock Music, Professor Peraino'
  },

  { 
    key: "AEM 4210", 
    namespaceTitle: "AEM 4210", 
    displayTitle: "AEM 4210", 
    professor: 'Futures, Options and Financial Derivatives, Professor Turvey'
  },

  { 
    key: "NS 3150", 
    namespaceTitle: "NS 3150", 
    displayTitle: "NS 3150", 
    professor: 'Obesity and the Regulation of Body Weight, Professor Berry'
  },

  { 
    key: "ORIE 3120", 
    namespaceTitle: "ORIE 3120", 
    displayTitle: "ORIE 3120", 
    professor: 'Practical Tools for Operations Research, Machine Learning and Data Science, Professor Frazier'
  },

  { 
    key: "ORIE 3310", 
    namespaceTitle: "ORIE 3310", 
    displayTitle: "ORIE 3310", 
    professor: 'Optimization II, Professor Gunluk'
  },

  { 
    key: "ORIE 3510", 
    namespaceTitle: "ORIE 3510", 
    displayTitle: "ORIE 3510", 
    professor: 'Intro to Engineering Stochastic Processes I, Professor Scully'
  },

  { 
    key: "AEM 3205", 
    namespaceTitle: "AEM 3205", 
    displayTitle: "AEM 3205", 
    professor: 'Ethics in Business and Organizations, Professor Doris'
  },

  { 
    key: "AEM 4670", 
    namespaceTitle: "AEM 4670", 
    displayTitle: "AEM 4670", 
    professor: 'Investments, Professor Murfin'
  },











];


  const [searchTerm, setSearchTerm] = useState("");
  const [filteredCourses, setFilteredCourses] = useState(courses);

  



  const [referralCount, setReferralCount] = useState(1); 
  // ****** Modify the use state depending on how many referral links are used and verified *****

  // const ProgressBar = ({ count }) => {
  //   const maxReferrals = 10; // Maximum number of referrals
  //   const progress = (count / maxReferrals) * 100; // Calculate progress percentage
    
  //   const indicators = Array.from({ length: maxReferrals }, (_, i) => i + 1);
  
  //   return (
  //     <div className={styles.referralTrackerWrapper}>
  //       <h2 className={styles.referralHeader}>Referral Tracker</h2>
  //       <div className={styles.progressBarWrapper}>
  //         <div className={styles.progressBarContainer}>
  //           <div className={styles.progressBar} style={{ width: `${progress}%` }}></div>
  //         </div>
  //         <div className={styles.progressNumbers}>
  //           {indicators.map((number) => (
  //             <div 
  //               key={number} 
  //               className={`${styles.progressNumber} ${number <= count ? styles.activeNumber : ''}`}
  //             >
  //               {number}
  //             </div>
  //           ))}
  //         </div>
  //       </div>
  //     </div>
  //   );
  // };
  
  
  
  
  
  
  
  


  useEffect(() => {
    const results = courses.filter(course => 
      course.displayTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
      course.professor.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredCourses(results);
  }, [searchTerm]);

  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(referralLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500); // Checkmark will disappear after 1.5 seconds
    });
  };


  

  const Popup = () => (
    <div className={styles.popupOverlay}>
      <div className={styles.popup}>
        <div className={styles.popupHeader}>
          <h2>Get up to 200 free messages for referrals 🧸</h2>
          <button onClick={() => setIsPopupVisible(false)}>🅇</button>
        </div>
        <div className={styles.popupContent}>
        <p>Earn 20 messages for every Cornellian who signs up with your link —
           and they will get an extra 20 messages too! You 
           will get your bonus messages the minute they sign up.
        </p>

          <div className={styles.referralRewards}>
            <p>1 referral = 20 messages</p>
            <p>2 referrals = 40 messages</p>
            <p>10 referrals = 200 messages🔥</p>
          </div>
          <div className={styles.referralLinkBox}>
            <input type="text" value={referralLink} readOnly />
            <button onClick={handleCopy}>
              {copied ? "✓" : "Copy"}
            </button>
          </div>
          <div className={styles.referralLinkBox}>
            <input type="text" value={"xyz@cornell.edu"} />
            <button onClick={handleCopy}>
              {copied ? "✈️" : "Send"}
            </button>
            
          </div>
        </div>
      </div>
    </div>
  );
  

  return (
    <div className={styles.container}>
          {/* <ProgressBar count={referralCount} /> */}
          {isPopupVisible && <Popup />}
{/* <button className={styles.referralText} onClick={handleReferralClick}>
 GET FREE MESSAGES! 🎁
</button> */}
      <div className={styles.classInquiryContainer}>
        <button
    className={styles.classInquiryButton}
    onClick={() => window.open('https://forms.gle/Gz6Th57GLCa6y2jR6', '_blank')}
  >
    DONT SEE YOUR CLASS?
  </button>
      </div>
      <h1 className={styles.title}>CornellGPT SP24</h1>
      <input
        type="text"
        placeholder="What class would you like help with?..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className={styles.searchInput}
      />
      <div className={styles.courseGrid}>
        {filteredCourses.map(course => (
          <CourseBox key={course.key} namespaceTitle={course.namespaceTitle} 
          displayTitle={course.displayTitle} professor={course.professor} 
          onClick={() => handleCourseClick(course.key)}/>
        ))}

      {isClassCodeModalVisible && (
        <ClassCodeModal
          isVisible={isClassCodeModalVisible}
          onClose={handleCloseModal}
          onSubmit={verifyClassCode}
          classCode={classCode}
          setClassCode={setClassCode}
        />
      )}

      </div>
      <footer className={styles.footer}>
    <a href="https://mountain-pig-87a.notion.site/Terms-Of-Use-CornellGPT-96c16de16cc94ff5b574fb4632b069e9" className={styles.footerLink} target="_blank">Terms of Use</a> |
        <a href="https://mountain-pig-87a.notion.site/Privacy-Policy-CornellGPT-6f20ea4c7a7741eabe19bfee5004a069" className={styles.footerLink} target="_blank">Privacy Policy</a>
    </footer>
    </div>
  );
      }

export default CourseCatalog;
