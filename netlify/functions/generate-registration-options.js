const admin = require('firebase-admin');
const { generateRegistrationOptions } = require('@simplewebauthn/server');

// مقداردهی اولیه Firebase Admin
// این کد فقط یک بار در اولین اجرای تابع اجرا می‌شود
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

  const { userID, username } = JSON.parse(event.body);

  // اطلاعات سایت شما
  const rpName = 'حسابداری شخصی';
  const rpID = new URL(process.env.URL).hostname; // دامین را از نتلیفای می‌خواند
  const origin = process.env.URL; // آدرس کامل سایت شما در نتلیفای

  // کلیدهای قبلی کاربر را از فایراستور بگیرید تا دوباره ثبت نشوند
  const userCredentials = [];
  const credentialsSnapshot = await db.collection('users').doc(userID).collection('passkey_credentials').get();
  credentialsSnapshot.forEach(doc => {
    const cred = doc.data();
    userCredentials.push({
      id: cred.credentialID,
      type: 'public-key',
      transports: cred.transports,
    });
  });

  const options = generateRegistrationOptions({
    rpName,
    rpID,
    userID,
    userName: username,
    attestationType: 'none',
    excludeCredentials: userCredentials,
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'required',
    },
  });

  // چالش تولید شده را به طور موقت در پروفایل کاربر ذخیره می‌کنیم
  await db.collection('users').doc(userID).set({
    currentChallenge: options.challenge
  }, { merge: true });

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(options),
  };
};
