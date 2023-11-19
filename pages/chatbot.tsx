import { useRef, useState, useEffect } from 'react';
import styles from '@/styles/Home.module.css';
import { Message } from '@/types/chat';
import ReactMarkdown from 'react-markdown';
import LoadingDots from '@/components/ui/LoadingDots';
import { Document } from 'langchain/document';
import 'highlight.js/styles/github.css';
import {
Accordion,
AccordionContent,
AccordionItem,
AccordionTrigger,
} from '@/components/ui/accordion';
import React from "react";
import { v4 as uuidv4 } from 'uuid';
import Image from 'next/image';
import katex from "katex";
import 'katex/dist/katex.min.css';


import { 
  messageContainsMath,
  MessageRenderer,
  parseBoldText,
  
} from './katex';

import {
  messageContainsCode,
  transformMessageWithCode
} from './codeblock'
import Sidebar from 'components/Sidebar';
import { Typewriter } from './typewriter'; 
import { useRouter } from 'next/router';

import Prism from "prismjs";
import "prismjs/themes/prism-tomorrow.css"; // You can choose different themes
import { InlineMath, BlockMath } from 'react-katex';
import hljs from 'highlight.js';
import MessageLimitModal from 'components/MessageLimitModal'; 



declare global {
  interface Window {
    katex: any;
  }
}
export default function Home() {
  const [query, setQuery] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [messageState, setMessageState] = useState<{
    messages: Message[];
    pending?: string;
    history: [string, string][];
    pendingSourceDocs?: any;
  }>({
    messages: [
      {
        message: 'Hi, what would you like to learn today?',
        type: 'apiMessage',
      },
    ],
    history: [],
  });
  const { messages, history } = messageState;
  const [refreshKey, setRefreshKey] = useState(0);
  const messageListRef = useRef<HTMLDivElement>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const userIDRef = useRef<string | null>(null);
  const sessionIDRef = useRef<string | null>(null);
  const [currentSessionID, setCurrentSessionID] = useState<string | null>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [courseTitle, setCourseTitle] = useState<string | string[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [courseHistoryRefreshKey, setCourseHistoryRefreshKey] = useState(0);
  const [showLimitReachedModal, setShowLimitReachedModal] = useState(false);


  const [firstMessageSent, setFirstMessageSent] = useState(false);




  const router = useRouter();
  useEffect(() => {
    if (router.query.course) {
        setCourseTitle(router.query.course);
        setIsLoading(false); // set loading to false when course is set
    }
}, [router.query.course]);



  const [showMoreSources, setShowMoreSources] = useState(false); // Show More Sources


  const handleSessionChange = async (newSessionID: string) => {
    setCurrentSessionID(newSessionID);
    // Fetch chat history for newSessionID and update the messageState
    if(courseTitle){
      setMessageState(prevState => ({ ...prevState, messages: [] }));
      await fetchChatHistory();
    }
    // Note: If you're directly updating the messages within fetchChatHistory, 
    // you may not need additional logic here to update the message state.
};

  useEffect(() => {
    if(courseTitle){
      fetchChatHistory();
    }

  }, [courseTitle]);

  function getOrGenerateUUID(key: string): string {
    let value = localStorage.getItem(key) || '';
    if (!value) {
        value = uuidv4();
        localStorage.setItem(key, value);
    }
    return value;
  }
  
  
  const fetchChatHistory = async () => {
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
    sessionIDRef.current = getOrGenerateUUID('sapp');
    try {
        //handling the edge case where you switch between course
        let response = await fetch('/api/getDocumentBySess', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                sapp: sessionIDRef.current,
            }),
        });
        const docData = await response.json();

        // 2. Compare 'course' field with currentTitle.
        const currentTitle = courseTitle; 

        if (docData.course !== currentTitle) {

            response = await fetch('/api/getLatestSess', {
              method: 'POST',
              headers: {
                  'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                  course: currentTitle,  // add this line
                  userID: userIDRef.current,
              })
          });

            if(response.ok){
              const latestChatData = await response.json();
              const newSappValue = latestChatData.sessionID;

            // Update the 'sapp' in localStorage and sessionIDRef.
              localStorage.setItem('sapp', newSappValue);
              sessionIDRef.current = newSappValue;
            }
            else{
              const errorText = await response.text();
              console.error("Error:", errorText);
            }
          }
        // Now fetch the chat history using the (possibly updated) sessionIDRef value.
        response = await fetch('/api/fetchHistory', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                userID: userIDRef.current,
                sessionID: sessionIDRef.current,
            }),
        });
        const data = await response.json();

        if (data.error) {
            console.error("Failed to fetch chat history:", data.error);
        } else {
          const transformedMessages = data.messages.flatMap(msg => ([
            {
              type: 'userMessage',
              message: msg.userQuestion,
            },
            {
              type: 'apiMessage',
              message: msg.answer,
              sourceDocs: msg.sourceDocs || [],
            }
          ]));
          transformedMessages.unshift({
            type: 'apiMessage',
            message: 'Hi, what would you like to learn today?'
          });

          setMessageState((state) => ({
            ...state,
            messages: transformedMessages,  // Ensure old messages are replaced, not appended
          }));
          if (messageListRef.current) {
            messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
          }
        }
    } catch (error) {
        console.error('An error occurred while fetching the chat history:', error);
    }
};







//********************************************************************************************************* */


  const handleCloseModal = () => {
    setShowLimitReachedModal(false);
    setLoading(false); // Ensure loading is also set to false if needed
    // Any other state resets if necessary
  };

  async function handleSubmit(e: any) {

    const namespaceToSearch: any = courseTitle;

    e.preventDefault();

    setError(null);

    if (!query) {
      alert('Its blank! Enter a question lol');
      return;
    }

    if (!firstMessageSent) {
      setFirstMessageSent(true);
    }
    
    const question = query.trim();
    console.log('Sending question:', question);



    setMessageState(prevState => ({
      ...prevState,
      messages: [
        ...prevState.messages,
        {
          type: 'userMessage',
          message: question,
        },

      ],
    }));


    
    setLoading(true);
    setQuery('');

    try {
      console.log(userIDRef.current, 'current userID in chatbot');
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question,
          messages,
          userID: userIDRef.current,     
          sessionID: sessionIDRef.current, 
          namespace: namespaceToSearch
        }),
      });
      const data = await response.json();

      //check if backend says the user still has messages left
      if(data.message === 'User has exceeded their limit for messages'){
        //update state
        setShowLimitReachedModal(true);
        setQuery('');
        setLoading(false);
      }
      else{
        if (data.sourceDocs) {
          data.sourceDocs = data.sourceDocs.map(doc => {
            if (doc.text) {
              // Replace sequences of spaces with a single space
              doc.text = doc.text.replace(/\s+/g, ' ').trim();
            }
            return doc;
          });
        }
  
        if (data.error) {
          setError(data.error);
        } else {
          if (!data.error) {
            // Update the state to replace the last message with the actual API response
            setMessageState(prevState => {
              const newMessages = [ ...prevState.messages];
              newMessages[newMessages.length] = {
                type: 'apiMessage',
                message: data.message,
                sourceDocs: data.sourceDocs,
              };
              return {
                ...prevState,
                messages: newMessages,
                history: [...prevState.history,   [question, data.message]],
              };
            });
          }}
          setLoading(false);
          //scroll to bottom
          messageListRef.current?.scrollTo(0, messageListRef.current.scrollHeight);
      }
    } catch (error) {
      setLoading(false);
      setError('An error occurred while fetching the data. Please try again.');
    }
  }





//*************************************************************************************************************** */
  //prevent empty submissions

  const handleEnter = (e) => {
    if (e.key === 'Enter') {
      if (e.shiftKey) {
        e.preventDefault(); // Prevent the default action (newline)
  
        if (textAreaRef.current) {
          const start = textAreaRef.current.selectionStart;
          const end = textAreaRef.current.selectionEnd;
          const value = textAreaRef.current.value;
          
          // Create the updated text with indentation
          const indent = "                                                                                                                                                                              "; // Two spaces for indentation
          const before = value.substring(0, start);
          const after = value.substring(end);
          const newValue = before + indent + after;
          
          setQuery(newValue); // Update the state
  
          // Move the cursor after the indentation
          setTimeout(() => {
            if (textAreaRef.current) { // Check again for TypeScript
              textAreaRef.current.selectionStart = start + indent.length;
              textAreaRef.current.selectionEnd = start + indent.length;
              textAreaRef.current.focus();
            }
          }, 0);
        }
      } else if (!e.shiftKey && query.trim()) {
        handleSubmit(e);
      }
    }
  };
  

  // document.addEventListener('DOMContentLoaded', () => {
  //   var isResizing = false;
  //   var lastDownY = 0;
  
  //   const handle = document.querySelector('.resize-handle') as HTMLElement; // Assert as HTMLElement
  //   const textarea = document.querySelector('.textarea') as HTMLTextAreaElement; // Assert as HTMLTextAreaElement
  
  //   if (handle && textarea) { // Check if elements are not null
  //     handle.addEventListener('mousedown', function(e: MouseEvent) { // Assert event type
  //       isResizing = true;
  //       lastDownY = e.clientY;
  //     });
  
  //     document.addEventListener('mousemove', function(e: MouseEvent) {
  //       if (!isResizing) {
  //         return;
  //       }
  //       var offsetBottom = document.body.offsetHeight - (textarea.offsetTop + textarea.offsetHeight);
  //       var newHeight = offsetBottom + (lastDownY - e.clientY);
  //       textarea.style.height = `${newHeight}px`;
  //       lastDownY = e.clientY;
  //     });
  
  //     document.addEventListener('mouseup', function() {
  //       isResizing = false;
  //     });
  //   }
  // });
  
  
  
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  function CodeBlock({ code }: { code: string }) {
    const [copied, setCopied] = useState(false);
  
    const handleCopy = () => {
      navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    };
  
    return (
      <div className={styles.codeBlock}>
        <pre className={styles.code}>
        <code style={{ color: "dark red" }}>{code}</code>
        </pre>
        <button
          className={styles.copyButton}
          onClick={handleCopy}
          disabled={copied}
        >
          {copied ? 'Copied🐻' : 'Copy'}
        </button>
      </div>
    );

    


////////////////////////////////////////////////////////////////////////////////////
  //   function getUniqueSources(docs: any[]): any[] {
  //     const seenSources: { [key: string]: boolean } = {};
  //     const uniqueDocs: any[] = [];
      
  //     for (let doc of docs) {
  //         const sourceName = doc.Source.split('/').pop();
  //         if (!seenSources[sourceName]) {
  //             seenSources[sourceName] = true;
  //             uniqueDocs.push(doc);
  //         }
  //     }
      
  //     return uniqueDocs;
  // }


  function renderHeader() {
    if (!hasUserMessages) {
      // If no user messages, return the centered title
      return (
        <div className="centeredTitle">
          <h1>CornellGPT: {courseTitle}</h1>
        </div>
      );
    } else {
      // If there are user messages, return the header section
      return (
        <div className="headerSection" style={{ marginLeft: '130px', marginTop: '10px' }}>
          <h1 className="text-4xl font-bold leading-[1.1] tracking-tighter text-center">
            CornellGPT: <span className={styles.selectedClassName}>{courseTitle}</span>
          </h1>
        </div>
      );
    }
  }
  

  
  
  
  /////////////////////////////////////////////////////////////////////////////////
  
  }
  // const hasUserMessages = messages.some(message => message.type === 'userMessage');

  // function renderHeader() {
  //   if (!hasUserMessages) {
  //     // If no user messages, return the centered title
  //     return (
  //       <div className="centeredTitle">
  //         <h1>CornellGPT: {courseTitle}</h1>
  //       </div>
  //     );
  //   } else {
  //     // If there are user messages, return the header section
  //     return (
  //       <div className="headerSection" style={{ marginLeft: '130px', marginTop: '10px' }}>
  //         <h1 className="text-4xl font-bold leading-[1.1] tracking-tighter text-center">
  //           CornellGPT: <span className={styles.selectedClassName}>{courseTitle}</span>
  //         </h1>
  //       </div>
  //     );
  //   }
  // }
  return (
    <>
    {showLimitReachedModal && 
            <MessageLimitModal setShowLimitReachedModal={handleCloseModal} />}
    <div className="appWrapper">
  <aside> 
    {courseTitle ? 
      <Sidebar className={courseTitle} onSessionChange={handleSessionChange} onNewChat={handleSessionChange} /> 
      : null}
  </aside>
  <div className="mainContent" key={refreshKey}>
    <div className="mx-auto flex flex-col gap-4">
    <div className="headerSection" style={{ marginLeft: '130px', marginTop: '10px' }}>  
        <h1 className="text-4xl font-bold leading-[1.1] tracking-tighter text-center">
          <span className={styles.selectedClassName}>{courseTitle}</span>
        </h1>
      </div>
          <main className={styles.main}>
            <div className={styles.cloud}>
              <div ref={messageListRef} className={styles.messagelist}>

                {messages.map((message, index) => {
    // Your message type handling logic 
    let icon;
    let className;
    let content;

    // const uniqueSources = getUniqueSources(message.sourceDocs).slice(0, 5);

    if (message.type === 'apiMessage') {
        icon = (
            <Image
                key={index}
                src="/bigblackbear.png"
                alt="AI"
                width="50"
                height="90"
                className={styles.boticon}
                priority
            />
        );
        className = styles.apimessage;
    } else {
        icon = (
            <Image
                key={index}
                src="/usericon.png"
                alt="Me"
                width="45"
                height="35"
                className={styles.usericon}
                priority
            />
        );
        className = loading && index === messages.length - 1
            ? styles.usermessagewaiting
            : styles.usermessage;
    }


  // if (messageContainsMath(message.message)) {
  //     content = <MessageRenderer key={index} message={message.message} />;
  // } else if (isCodeMessage) {
  //     content = <CodeBlock key={index} code={transformMessageWithCode(message.message)} />;
  // } else {
  //     if (message.type === 'apiMessage' && !isCodeMessage && !messageContainsMath) {  
  //         content = <Typewriter message={message.message} />; } 
  //     else {
  //         content = <span>{message.message}</span>;
  //     }
  // }

  

  const isCodeMessage = index > 0 && message.type === 'apiMessage' && messageContainsCode(messages[index - 1].message, message.message);
  const isLatestApiMessage = index === messages.length - 1 && message.type === 'apiMessage';
  
  
//&& !isCodeMessage && !messageContainsMath
  if (messageContainsMath(message.message)) {
    content = <MessageRenderer key={index} message={message.message} />;
  } else if (isCodeMessage) {
    content = <CodeBlock key={index} code={transformMessageWithCode(message.message)} />;
  } else if (message.type === 'apiMessage') {                        
    content = <Typewriter key={index} message={parseBoldText(message.message)} animate={isLatestApiMessage} />;
  } else {
    content = <span>{parseBoldText(message.message)}</span>;
  }

  




  // if (message.type === 'apiMessage' && !isCodeMessage) {
  //   const formattedMessage = message.message.replace(/\n/g, '<br/>');
  //   content = <div dangerouslySetInnerHTML={{ __html: formattedMessage }} />;}
  //   } else {
  //     content = <Typewriter message={message.message} />;
  //   }
  // } else if (isCodeMessage) {
  //   content = <CodeBlock key={index} code={transformMessageWithCode(message.message)} />;
  // } else {
  //   content = <span>{message.message}</span>;
  // }


  // if (messageContainsMath(message.message)) {
  // content = <MessageRenderer key={index} message={message.message} />;
  //  }
  //  else if (message.type === 'apiMessage' && !isCodeMessage) {
  //   const normalizedMessage = message.message.replace(/\r\n/g, '\n');
  //   const lines = normalizedMessage.split('\n');
  //   content = lines.map((line, idx) => (
  //     <div key={idx} className="line">
  //       <Typewriter message={line} />
  //       {idx < lines.length - 1 && <br />}
  //     </div>
  //   ));
  // } else if (isCodeMessage) {
  //   content = <CodeBlock key={index} code={transformMessageWithCode(message.message)} />;
  // } else {
  //   content = <span>{message.message}</span>;
  // }

    if (isLoading) {
      return <>Loading...</>;
    }   
    return (
        <>
            <div key={`chatMessage-${index}`} className={className}>
                {icon}
                <div className={styles.markdownanswer}
                    style={
                        isCodeMessage ? {
                            backgroundColor: "#f5f5f5",
                            padding: "10px",
                            borderRadius: "5px",
                            display: "block",
                            margin: "1em 0",
                            border: "1px solid #ddd",
                            boxShadow: "0 2px 5px rgba(0, 0, 0, 0.1)",
                            fontFamily: "'Courier New', monospace",
                            fontSize: "14px",
                            color: "black",
                            lineHeight: "1.4",
                        } : {}
                    }>
                    {content}
                </div>
            </div>
                      {message.sourceDocs && (
                        <div
                          className="p-5"
                          key={`sourceDocsAccordion-${index}`}
                        >
                          <Accordion
                            type="single"
                            collapsible
                            className="flex-col"
                          >
                            {message.sourceDocs.slice(0, showMoreSources ? message.sourceDocs.length : 5).map((doc: any, index) => (
                              <div key={`messageSourceDocs-${index}`}> 
                              {/* //look at this section */}
                                <AccordionItem value={`item-${index}`}>
                                  <AccordionTrigger>
                                    <h3>Source {index + 1}</h3>
                                  </AccordionTrigger>
                                  <AccordionContent>
                                    <ReactMarkdown linkTarget="_blank">
                                      {doc.text}
                                    </ReactMarkdown>
                                    <p className="mt-2">
                                    <b>Source: </b> 
                                    <a href={`/pdfs/${doc.Source.split('/').pop()}#page=${doc.Page_Number}`} target="_blank" rel="noopener noreferrer" 
                                    style={{
                                      color: 'red',
                                      textDecoration: 'underline',
                                      cursor: 'pointer',
                                      fontWeight: 625
                                  }}>
                                    {doc.Source.split('/').pop()}
                                    </a>

                                    </p>
                                    <p>
                                      <b> Page number: </b> {doc.Page_Number}
                                    </p>
                                    <p>
                                      <b> Total Pages: </b> {doc.Total_Pages}
                                    </p>
                                  </AccordionContent>
                                </AccordionItem>
                              </div>
                            ))}



 {message.sourceDocs.length > 5 && !showMoreSources && (
  <button className="p-2 text-sm text-red-500" onClick={() => setShowMoreSources(true)}>
    Show More
  </button>
)}
{showMoreSources && (
  <button className="p-2 text-sm text-red-500" onClick={() => setShowMoreSources(false)}>
    Show Less
  </button>
)}   
                          </Accordion>
                        </div>
                      )}
                    </>
                  );
                })}
              </div>
            </div>
            <div className={styles.center}>
              <div className={styles.cloudform}>
                <form onSubmit={handleSubmit}>
                  <textarea
                    disabled={loading}
                    onKeyDown={handleEnter}
                    ref={textAreaRef}
                    autoFocus={false}
                    rows={1}
                    maxLength={100000} // input size adjustment***
                    id="userInput"
                    name="userInput"
                    placeholder={
                      loading
                        ? 'Retrieving...'
                        : 'Message CornellGPT...'
                    }
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className={styles.textarea}
                  />
                  <button
                    type="submit"
                    disabled={loading}
                    className={styles.generatebutton}
                  >
                    {loading ? (
                      <div className={styles.loadingwheel}>
                        <LoadingDots color="rgb(146, 40, 40)" />
                      </div>
                    ) : (
                      // Send icon SVG in input field
                      <svg
                        viewBox="0 0 20 20"
                        className={styles.svgicon}
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z"></path>
                      </svg>
                    )}
                  </button>
                </form>
              </div>
            </div>
            {error && (
              <div className="border border-red-400 rounded-md p-4">
                <p className="text-red-500">{error}</p>
              </div>
            )}
          </main>
        </div>
        <footer className="m-auto p-4">
        </footer>
        </div>
        </div>
    </>
  );
}










