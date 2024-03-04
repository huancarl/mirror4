import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import styles from '@/styles/professorCoursePage.module.css';
import {withSession, isAuthenticated} from 'utils/session';

//Make sure that the page cannot be accessed without being a professor
// export const getServerSideProps = withSession(async ({ req, res }) => {
//     const user = await isAuthenticated(req);
//     if (!user) {

//         if(!user.isProfessor){
//             return {
//                 redirect: {
//                     destination: '/loginEmail', // Redirect to the sign-in page
//                     permanent: false,
//                 },
//             };
//         }
//         return {
//             redirect: {
//                 destination: '/loginEmail', // Redirect to the sign-in page
//                 permanent: false,
//             },
//         };
//     }
//     // User is authenticated
//     return { props: { user } };
//   });
  




function ProfessorHome() {

    const [className, setClassName] = useState<string>('');
    const userIDRef = useRef<string | null>(null);


    async function fetchProfClass() {
        const response = await fetch('/api/fetchClassOfProfessor', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        const professorToClassMapData = await response.json();
        const professorToClassMap = professorToClassMapData.profMap;

        const sessionRes = await fetch('/api/userInfo');
        const sessionData = await sessionRes.json();

        if (sessionRes.ok) {
          // Set userID to the user's email from the session
          userIDRef.current = sessionData.email;

          if(userIDRef.current){

            let nameOfClass = professorToClassMap[userIDRef.current];
            nameOfClass = nameOfClass.replace(/_/g, ' ');

            setClassName(nameOfClass)
          }

          } else {
            // Handle the case where the session is not available
            console.error('Session not found:', sessionData.error);
              return;
          }
        return professorToClassMap;
    }

    useEffect(() => {
        fetchProfClass();

        console.log(className, 'classname');

    }, []);


    return (
      <div className={styles.container}>
        <h1 className={styles.courseTitle}>{className}</h1>
        <div className={styles.buttonsContainer}>
          <div className={styles.row}>
            <div className={styles.buttonWrapper}>
              <Link href={`/professor-materials?course=${className}`}>
                <button className={styles.button}>Upload or Delete Chatbot Access Materials</button>
              </Link>
            </div>
            <div className={styles.buttonWrapper}>
              <Link href="/professor-prompt">
                <button className={styles.button}>Adjust Class Chatbot Settings</button>
              </Link>
            </div>
          </div>
          <div className={styles.row}>
            <div className={styles.buttonWrapper}>
              <Link href={`/chatbot?course=${className}`}>
                <button className={styles.button}>Student Chatbot View</button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  export default ProfessorHome;
