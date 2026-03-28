import React, { createContext, useContext, useState, useEffect } from "react";
import { db } from "../firebase";
import { doc, collection, onSnapshot, setDoc } from "firebase/firestore";
import { TOURNAMENT_ID, DEFAULT_PAR, DEFAULT_YARDS } from "../constants";

const CourseContext = createContext(null);

export function CourseProvider({ children }) {
  const [course, setCourse]             = useState(null);
  const [courseLibrary, setCourseLibrary] = useState([]);

  useEffect(() => {
    const unsubCourse = onSnapshot(
      doc(db, "tournaments", TOURNAMENT_ID, "settings", "course"),
      snap => {
        if (snap.exists()) {
          const data = snap.data();
          // Defensive: ensure par and yards are valid arrays
          if (!Array.isArray(data.par) || data.par.length !== 18) data.par = DEFAULT_PAR;
          if (!Array.isArray(data.yards) || data.yards.length !== 18) data.yards = DEFAULT_YARDS;
          setCourse(data);
        } else {
          // First run — seed default course
          const defaultCourse = {
            name: "Keller Golf Course", city: "Maplewood, MN", slope: 128, rating: 70.4,
            par: DEFAULT_PAR, yards: DEFAULT_YARDS,
            description: "A classic Minnesota municipal course winding through mature oaks and wetlands. Tight fairways reward accuracy over distance.",
            scorecardImage: null, scorecardPdf: null,
          };
          setDoc(doc(db, "tournaments", TOURNAMENT_ID, "settings", "course"), defaultCourse);
          setCourse(defaultCourse);
        }
      }
    );

    const unsubLibrary = onSnapshot(
      collection(db, "tournaments", TOURNAMENT_ID, "course_library"),
      snap => setCourseLibrary(
        snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => a.name.localeCompare(b.name))
      )
    );

    return () => { unsubCourse(); unsubLibrary(); };
  }, []);

  return (
    <CourseContext.Provider value={{ course, setCourse, courseLibrary }}>
      {children}
    </CourseContext.Provider>
  );
}

export const useCourse = () => useContext(CourseContext);
