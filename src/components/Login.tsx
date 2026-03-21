import React from 'react';
import { auth, db } from '../firebase';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Hotel } from 'lucide-react';

export const Login = () => {
  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      
      // Check if user exists in Firestore
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);
      
      if (!userSnap.exists()) {
        // Create new user profile
        // Default to 'user' role, unless it's the first user or a specific email
        const isSuperAdmin = user.email === 'alper28072011@gmail.com';
        await setDoc(userRef, {
          uid: user.uid,
          email: user.email,
          role: isSuperAdmin ? 'super_admin' : 'user',
          allowed_hotels: [],
          createdAt: serverTimestamp()
        });
      }
    } catch (error) {
      console.error("Login Error:", error);
      alert("Giriş yapılırken bir hata oluştu.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center text-indigo-600">
          <Hotel size={48} strokeWidth={1.5} />
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Hotel Advisor Raporlama
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Lütfen devam etmek için giriş yapın
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <button
            onClick={handleLogin}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Google ile Giriş Yap
          </button>
        </div>
      </div>
    </div>
  );
};
