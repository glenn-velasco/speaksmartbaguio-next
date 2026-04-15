import * as admin from "firebase-admin";


if (!admin.apps.length) {

    try {
        const serviceAccount = {
            projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
            clientEmail: process.env.NEXT_PUBLIC_FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.NEXT_PUBLIC_FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
        }

        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
        });

    } catch (error) {

        console.error("Firebase admin initialization error", error);
    }

}

const adminDb = admin.firestore();
const adminAuth = admin.auth();

export { adminDb, adminAuth, admin };