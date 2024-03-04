import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/router';
import styles from '@/styles/Redeem.module.css'; // Adjust the path if necessary

const AccessPage = () => {
  const router = useRouter();
  const [showErrorMessage, setShowErrorMessage] = useState(false);
  const [isGapiReady, setIsGapiReady] = useState(false);
  const [referralCode, setReferralCode] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const referralCodeRef = useRef(referralCode);
  
  useEffect(() => {
    referralCodeRef.current = referralCode;
  }, [referralCode]);

  useEffect(() => {
    if (router.isReady) {
      const refCode = router.query.referralCode;
      if (refCode) {
        setReferralCode(String(refCode));
      }

      const initializeGis = () => {
        window.google.accounts.id.initialize({
          client_id: '143724527673-n3nkdbf2gh0ea2lgqrthh6k4142sofv1.apps.googleusercontent.com', // Replace with your client ID
          callback: handleCredentialResponse,
        });
        const signInDiv = document.getElementById("signInDiv");
        if (signInDiv) {
          window.google.accounts.id.renderButton(
            signInDiv,
            { theme: "filled_white", size: "large" }
          );
          setIsGapiReady(true);
        } else {
          console.error("Google Sign In div not found");
        }
      };
  
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.onload = initializeGis;
      script.async = true;
      script.defer = true;
      document.body.appendChild(script);
  
      return () => {
        document.body.removeChild(script);
      };
    }

    
  }, [router.isReady, router.query.referralCode]);

  const handleCredentialResponse = async (response) => {
    const decodedToken = JSON.parse(atob(response.credential.split('.')[1]));
    const email = decodedToken.email;
  
    if (!email.endsWith('@cornell.edu')) {
      alert('Cornell emails only (@cornell.edu)');
      return;
    }

    const result = await fetch('/api/addNewUser', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token: response.credential, link: referralCodeRef.current }),
    });

    const data = await result.json();
    if (data.created) {

      if(data.isProfessor){
        router.replace('/ProfessorCoursePage');
      }
      else{
        router.replace('/coursePage');
      }
      
    } else {
      alert(data.message);
    }
  };

  const handleBack = () => {
    router.back();
  };

  return (
    <div className={styles.container}>
      <button onClick={handleBack} className={styles.backButton}>←</button>
      <div className={styles.LogIn}>
        Create Your Account
        <div className={styles.noteText}>
          Use your @cornell.edu email
        </div>
      </div>
      <div id="signInDiv" className={styles.signDiv}></div>
      {showErrorMessage && (
        <div className={styles.errorMessage}>
          Error message if needed
        </div>
      )}
      <footer className={styles.footer}>
      <a href="https://mountain-pig-87a.notion.site/Terms-Of-Use-CornellGPT-96c16de16cc94ff5b574fb4632b069e9" className={styles.footerLink} target="_blank">Terms of Use</a> |
        <a href="https://mountain-pig-87a.notion.site/Privacy-Policy-CornellGPT-6f20ea4c7a7741eabe19bfee5004a069" className={styles.footerLink} target="_blank">Privacy Policy</a>
      </footer>
    </div>
  );
};

export default AccessPage;
