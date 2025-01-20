import { Course, Tee } from "@/types/scorecard";

export const defaultTee: Tee = {
  id: -1,
  name: "",
  courseRating18: 0,
  slopeRating18: 0,
  courseRatingFront9: 0,
  slopeRatingFront9: 0,
  courseRatingBack9: 0,
  slopeRatingBack9: 0,
  outPar: 0,
  inPar: 0,
  totalPar: 0,
  outDistance: 0,
  inDistance: 0,
  totalDistance: 0,
  gender: "mens" as "mens" | "ladies",
  distanceMeasurement: "meters" as "meters" | "yards",
  holes: [
    {
      holeNumber: 1,
      par: 0,
      hcp: 0,
      distance: 0,
    },
    {
      holeNumber: 2,
      par: 0,
      hcp: 0,
      distance: 0,
    },
    {
      holeNumber: 3,
      par: 0,
      hcp: 0,
      distance: 0,
    },
    {
      holeNumber: 4,
      par: 0,
      hcp: 0,
      distance: 0,
    },
    {
      holeNumber: 5,
      par: 0,
      hcp: 0,
      distance: 0,
    },
    {
      holeNumber: 6,
      par: 0,
      hcp: 0,
      distance: 0,
    },
    {
      holeNumber: 7,
      par: 0,
      hcp: 0,
      distance: 0,
    },
    {
      holeNumber: 8,
      par: 0,
      hcp: 0,
      distance: 0,
    },
    {
      holeNumber: 9,
      par: 0,
      hcp: 0,
      distance: 0,
    },
    {
      holeNumber: 10,
      par: 0,
      hcp: 0,
      distance: 0,
    },
    {
      holeNumber: 11,
      par: 0,
      hcp: 0,
      distance: 0,
    },
    {
      holeNumber: 12,
      par: 0,
      hcp: 0,
      distance: 0,
    },
    {
      holeNumber: 13,
      par: 0,
      hcp: 0,
      distance: 0,
    },
    {
      holeNumber: 14,
      par: 0,
      hcp: 0,
      distance: 0,
    },
    {
      holeNumber: 15,
      par: 0,
      hcp: 0,
      distance: 0,
    },
    {
      holeNumber: 16,
      par: 0,
      hcp: 0,
      distance: 0,
    },
    {
      holeNumber: 17,
      par: 0,
      hcp: 0,
      distance: 0,
    },
    {
      holeNumber: 18,
      par: 0,
      hcp: 0,
      distance: 0,
    },
  ],
  approvalStatus: "pending" as "pending" | "approved",
};

export const validCourse: Course = {
  name: "Ballerud",
  approvalStatus: "pending",
  id: -1,
  tees: [
    {
      id: -1,
      courseId: -1,
      name: "RED",
      courseRating18: 131.2,
      slopeRating18: 126,
      courseRatingFront9: 65.6,
      slopeRatingFront9: 63,
      courseRatingBack9: 65.6,
      slopeRatingBack9: 63,
      outPar: 29,
      inPar: 28,
      totalPar: 57,
      outDistance: 1353,
      inDistance: 1415,
      totalDistance: 2768,
      gender: "ladies",
      distanceMeasurement: "yards",
      holes: [
        {
          holeNumber: 1,
          par: 3,
          hcp: 3,
          distance: 123,
        },
        {
          holeNumber: 2,
          par: 3,
          hcp: 2,
          distance: 140,
        },
        {
          holeNumber: 3,
          par: 3,
          hcp: 1,
          distance: 140,
        },
        {
          holeNumber: 4,
          par: 4,
          hcp: 4,
          distance: 200,
        },
        {
          holeNumber: 5,
          par: 3,
          hcp: 6,
          distance: 140,
        },
        {
          holeNumber: 6,
          par: 3,
          hcp: 5,
          distance: 130,
        },
        {
          holeNumber: 7,
          par: 3,
          hcp: 8,
          distance: 150,
        },
        {
          holeNumber: 8,
          par: 3,
          hcp: 7,
          distance: 130,
        },
        {
          holeNumber: 9,
          par: 4,
          hcp: 9,
          distance: 200,
        },
        {
          holeNumber: 10,
          par: 3,
          hcp: 11,
          distance: 130,
        },
        {
          holeNumber: 11,
          par: 3,
          hcp: 10,
          distance: 147,
        },
        {
          holeNumber: 12,
          par: 3,
          hcp: 12,
          distance: 130,
        },
        {
          holeNumber: 13,
          par: 3,
          hcp: 13,
          distance: 130,
        },
        {
          holeNumber: 14,
          par: 3,
          hcp: 14,
          distance: 140,
        },
        {
          holeNumber: 15,
          par: 3,
          hcp: 15,
          distance: 159,
        },
        {
          holeNumber: 16,
          par: 4,
          hcp: 16,
          distance: 200,
        },
        {
          holeNumber: 17,
          par: 3,
          hcp: 17,
          distance: 189,
        },
        {
          holeNumber: 18,
          par: 3,
          hcp: 18,
          distance: 190,
        },
      ],
      approvalStatus: "pending",
    },
  ],
};
