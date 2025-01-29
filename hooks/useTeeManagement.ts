import { useState, useCallback } from "react";
import { Course, Tee, Hole } from "@/types/scorecard";

// Helper function to create a unique key for tees
export const getTeeKey = (courseId: number, teeName: string) =>
  `${courseId}_${teeName}`;

// Temporary ID counter and generator
let tempIdCounter = -1;
const generateTempId = () => tempIdCounter--;

export interface TeeState {
  fetchedTees: { [courseId: number]: Tee[] };
  modifications: {
    courses: { [courseId: number]: Course };
    tees: { [key: string]: Tee };
  };
}

export function useTeeManagement() {
  const [fetchedTees, setFetchedTees] = useState<TeeState["fetchedTees"]>({});
  const [modifications, setModifications] = useState<TeeState["modifications"]>(
    {
      courses: {},
      tees: {},
    }
  );

  const getEffectiveTees = useCallback(
    (courseId: number | undefined) => {
      if (courseId === undefined) return [];

      // For user-created courses (negative IDs), only return modified tees
      if (courseId < 0) {
        return Object.values(modifications.tees).filter(
          (tee: Tee) => tee.courseId === courseId
        );
      }

      // For fetched courses (positive IDs), combine fetched and modified tees
      const fetchedCourseTees = fetchedTees[courseId] || [];

      const unmodifiedTees = fetchedCourseTees.filter(
        (tee: Tee) => !modifications.tees[getTeeKey(courseId, tee.name)]
      );

      const modifiedTees = Object.values(modifications.tees).filter(
        (tee: Tee) => tee.courseId === courseId
      );

      return [...unmodifiedTees, ...modifiedTees];
    },
    [fetchedTees, modifications.tees]
  );

  const updateFetchedTees = useCallback((courseId: number, tees: Tee[]) => {
    setFetchedTees((prev) => ({
      ...prev,
      [courseId]: tees,
    }));
  }, []);

  const addCourse = useCallback((course: Course) => {
    if (!course.tees || course.tees.length === 0) {
      throw new Error("Course must have at least one tee");
    }

    const newCourse = {
      ...course,
      id: generateTempId(),
      approvalStatus: "pending" as const,
    };

    const firstTee = {
      ...course.tees[0],
      id: generateTempId(),
      courseId: newCourse.id,
      approvalStatus: "pending" as const,
      holes: course.tees[0].holes,
    };

    const teeKey = getTeeKey(newCourse.id, firstTee.name);

    setModifications((prev) => ({
      ...prev,
      courses: {
        ...prev.courses,
        [newCourse.id]: newCourse,
      },
      tees: {
        ...prev.tees,
        [teeKey]: firstTee,
      },
    }));

    return {
      course: newCourse,
      tee: firstTee,
      teeKey,
    };
  }, []);

  const addTee = useCallback((courseId: number, newTee: Tee) => {
    const teeWithId = {
      ...newTee,
      id: generateTempId(),
      courseId,
      approvalStatus: "pending" as const,
      holes: newTee.holes,
    };

    const teeKey = getTeeKey(courseId, newTee.name);

    setModifications((prev) => ({
      ...prev,
      tees: {
        ...prev.tees,
        [teeKey]: teeWithId,
      },
    }));

    return {
      tee: teeWithId,
      teeKey,
    };
  }, []);

  const editTee = useCallback(
    (courseId: number, currentTeeName: string | undefined, updatedTee: Tee) => {
      const editedTee: Tee = {
        ...updatedTee,
        id: generateTempId(),
        courseId,
        approvalStatus: "pending" as const,
        holes: updatedTee.holes,
      };

      const teeKey = getTeeKey(courseId, updatedTee.name);

      setModifications((prev) => ({
        ...prev,
        tees: {
          ...prev.tees,
          [teeKey]: editedTee,
        },
      }));

      return {
        tee: editedTee,
        teeKey,
      };
    },
    [getEffectiveTees]
  );

  return {
    fetchedTees,
    modifications,
    getEffectiveTees,
    updateFetchedTees,
    addCourse,
    addTee,
    editTee,
  };
}
