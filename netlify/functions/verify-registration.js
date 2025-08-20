const admin = require('firebase-admin');
const { verifyRegistrationResponse } = require('@simplewebauthn/server');

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

  // چالشی که قبلا ذخیره کرده بودیم را از فایراستور می‌خوانیم
  const userDoc = await db.collection('users').doc(userID).get();
  const { currentChallenge } = userDoc.data();

  const rpID = new URL(process.env.URL).hostname;
  const origin = process.env.URL;

  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response: body,
      expectedChallenge: currentChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    });
  } catch (error) {
    console.error(error);
    return { statusCode: 400, body: JSON.stringify({ error: error.message }) };
  }

  const { verified, registrationInfo } = verification;

  if (verified) {
    const { credentialPublicKey, credentialID, counter, credentialDeviceType, credentialBackedUp } = registrationInfo;
    
    // کلید جدید را در یک کالکشن مجزا برای کاربر ذخیره می‌کنیم
    const newCredentialRef = db.collection('users').doc(userID).collection('passkey_credentials').doc();
    await newCredentialRef.set({
      credentialID,
      publicKey: Buffer.from(credentialPublicKey).toString('base64'), // برای ذخیره در فایراستور
      counter,
      transports: body.response.transports,
      deviceType: credentialDeviceType,
      backedUp: credentialBackedUp,
    });
  }

  // چالش استفاده شده را پاک می‌کنیم
  await db.collection('users').doc(userID).update({ currentChallenge: null });

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ verified }),
  };
};
