import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDTCAUA_-jOR-D5dZ4pgPNFOpdkYvhZhC0",
  authDomain: "manager-report-9be9a.firebaseapp.com",
  projectId: "manager-report-9be9a",
  storageBucket: "manager-report-9be9a.firebasestorage.app",
  messagingSenderId: "937374420814",
  appId: "1:937374420814:web:ec09f54ecc9730a720581f"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
