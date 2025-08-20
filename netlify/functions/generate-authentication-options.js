const admin = require('firebase-admin');
const { generateAuthenticationOptions } = require('@simplewebauthn/server');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    }),
  });
}
const db = admin.firestore();

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }
  
  const { userID } = JSON.parse(event.body);

  const userCredentials = [];
  const snapshot = await db.collection('users').doc(userID).collection('passkey_credentials').get();
  snapshot.forEach(doc => {
    const cred = doc.data();
    userCredentials.push({
      id: cred.credentialID,
      type: 'public-key',
      transports: cred.transports,
    });
  });

  const options = generateAuthenticationOptions({
    allowCredentials: userCredentials,
    userVerification: 'required',
  });

  await db.collection('users').doc(userID).set({
    currentChallenge: options.challenge
  }, { merge: true });

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(options),
  };
};