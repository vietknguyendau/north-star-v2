import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey:            "AIzaSyDpYo3_0H5pHglBWLt86qtZRLvFu8rQPUA",
  authDomain:        "north-star-amateur-series.firebaseapp.com",
  projectId:         "north-star-amateur-series",
  storageBucket:     "north-star-amateur-series.firebasestorage.app",
  messagingSenderId: "758596324887",
  appId:             "1:758596324887:web:7d876f8b1d46f745af9652",
  measurementId:     "G-JN1MKD332Q",
};

const app = initializeApp(firebaseConfig);
export const db  = getFirestore(app);
export const storage = getStorage(app);
