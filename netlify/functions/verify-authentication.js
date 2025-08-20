const admin = require('firebase-admin');
const { verifyAuthenticationResponse } = require('@simplewebauthn/server');

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

  const body = JSON.parse(event.body);
  const userID = body.response.userHandle;
  
  const userDoc = await db.collection('users').doc(userID).get();
  const { currentChallenge } = userDoc.data();
  
  const credentialQuery = await db.collection('users').doc(userID).collection('passkey_credentials').where('credentialID', '==', body.id).limit(1).get();
  if (credentialQuery.empty) {
    return { statusCode: 404, body: 'Credential not found' };
  }
  const credentialDoc = credentialQuery.docs[0];
  const credential = credentialDoc.data();
  
  const rpID = new URL(process.env.URL).hostname;
  const origin = process.env.URL;

  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response: body,
      expectedChallenge: currentChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      authenticator: {
        credentialID: credential.credentialID,
        credentialPublicKey: Buffer.from(credential.publicKey, 'base64'),
        counter: credential.counter,
        transports: credential.transports,
      },
    });
  } catch (error) {
    console.error(error);
    return { statusCode: 400, body: JSON.stringify({ error: error.message }) };
  }

  const { verified, authenticationInfo } = verification;

  if (verified) {
    // شمارنده را در دیتابیس آپدیت کن
    await credentialDoc.ref.update({ counter: authenticationInfo.newCounter });
  }
  
  await db.collection('users').doc(userID).update({ currentChallenge: null });

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ verified }),
  };
};
