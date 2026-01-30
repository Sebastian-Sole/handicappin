import { useState, useCallback, useMemo } from "react";
import { Course, Tee } from "@/types/scorecard-input";

// Helper function to create a unique key for tees
export const getTeeKey = (courseId: number, teeName: string, gender: string) =>
  `${courseId}_${teeName}_${gender}`;

// Temporary ID counter and generator
let tempIdCounter = -1;
const generateTempId = () => tempIdCounter--;

export interface TeeState {
  fetchedTees: { [courseId: number]: Tee[] };
  modifications: {
    courses: { [courseId: number]: Course };
    tees: { [key: string]: Tee };
  };
  selectedTeeKey?: string;
  selectedCourseId?: number;
}

export function useTeeManagement() {
  const [fetchedTees, setFetchedTees] = useState<TeeState["fetchedTees"]>({});
  const [modifications, setModifications] = useState<TeeState["modifications"]>(
    {
      courses: {},
      tees: {},
    }
  );
  const [selectedTeeKey, setSelectedTeeKey] = useState<string | undefined>();
  const [selectedCourseId, setSelectedCourseId] = useState<
    number | undefined
  >();

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
        (tee: Tee) => !modifications.tees[getTeeKey(courseId, tee.name, tee.gender)]
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

    const teeKey = getTeeKey(newCourse.id, firstTee.name, firstTee.gender);

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

    const teeKey = getTeeKey(courseId, newTee.name, newTee.gender);

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
    (courseId: number, _currentTeeName: string | undefined, updatedTee: Tee) => {
      const editedTee: Tee = {
        ...updatedTee,
        id: generateTempId(),
        courseId,
        approvalStatus: "pending" as const,
        holes: updatedTee.holes,
      };

      const teeKey = getTeeKey(courseId, updatedTee.name, updatedTee.gender);

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
    []
  );

  // Get the currently selected tee
  const selectedTee = useMemo(() => {
    if (!selectedTeeKey || !selectedCourseId) return undefined;
    return getEffectiveTees(selectedCourseId)?.find(
      (tee) => getTeeKey(selectedCourseId, tee.name, tee.gender) === selectedTeeKey
    );
  }, [selectedTeeKey, selectedCourseId, getEffectiveTees]);

  // Get the complete tee data for editing
  const getCompleteEditTee = useMemo(() => {
    if (!selectedTee || !selectedCourseId) return undefined;

    // For fetched tees
    if (selectedCourseId > 0) {
      // Get the tee with its holes from fetchedTees
      const fetchedTee = fetchedTees[selectedCourseId]?.find(
        (tee) => tee.name === selectedTee.name && tee.gender === selectedTee.gender
      );

      // Check if this tee has been modified
      const teeKey = getTeeKey(selectedCourseId, selectedTee.name, selectedTee.gender);
      const modifiedTee = modifications.tees[teeKey];

      // If the tee has been modified, use that data
      if (modifiedTee) {
        return modifiedTee;
      }

      // Otherwise use the fetched tee data
      if (fetchedTee) {
        return fetchedTee;
      }
    }

    // For user-created tees
    const teeKey = getTeeKey(selectedCourseId, selectedTee.name, selectedTee.gender);
    const modifiedTee = modifications.tees[teeKey];
    if (modifiedTee) {
      return modifiedTee;
    }

    return undefined;
  }, [selectedTee, selectedCourseId, fetchedTees, modifications.tees]);

  const selectCourse = useCallback((courseId: number | undefined) => {
    setSelectedCourseId(courseId);
    setSelectedTeeKey(undefined); // Clear tee selection when course changes
  }, []);

  const selectTee = useCallback((teeKey: string | undefined) => {
    setSelectedTeeKey(teeKey);
  }, []);

  return {
    fetchedTees,
    modifications,
    selectedTeeKey,
    selectedCourseId,
    selectedTee,
    getCompleteEditTee,
    getEffectiveTees,
    updateFetchedTees,
    addCourse,
    addTee,
    editTee,
    selectCourse,
    selectTee,
  };
}
