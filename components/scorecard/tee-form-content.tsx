// tee-form-content.tsx
"use client";
import React, { useMemo } from "react";
import { TriangleAlert } from "lucide-react";

import { Alert, AlertTitle, AlertDescription } from "../ui/alert";
import { Separator } from "../ui/separator";
import { Large } from "../ui/typography";
import { RadioGroup, RadioGroupItem } from "../ui/radio-group";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import { Input } from "@/components/ui/input";
import { Tee } from "@/types/scorecard";

interface TeeFormContentProps {
  tee: Tee; // The entire tee we are editing
  onTeeChange: (updated: Tee) => void; // Callback any time a field changes
}

export function TeeFormContent({ tee, onTeeChange }: TeeFormContentProps) {
  return (
    <>
      <Alert>
        <TriangleAlert className="h-4 w-4" />
        <AlertTitle>Heads up!</AlertTitle>
        <AlertDescription>
          Enter <strong>18 hole values</strong> for the new tee even if you are
          adding a tee for a 9-hole course. You can choose to enter a 9-hole
          round on this tee when you submit your scorecard. The course pro shop
          can help you find the correct information.
        </AlertDescription>
      </Alert>

      <div className="space-y-2 py-4">
        <TeeInfoFields tee={tee} onTeeChange={onTeeChange} />
        <TeeRatingFields tee={tee} onTeeChange={onTeeChange} />
        <TeeHoleTable tee={tee} onTeeChange={onTeeChange} />
      </div>
    </>
  );
}

function TeeInfoFields({ tee, onTeeChange }: TeeFormContentProps) {
  return (
    <div className="space-y-4 pb-4">
      <Separator />
      <Large>Tee Information</Large>

      {/* Name */}
      <div className="space-y-2">
        <label htmlFor="teeName" className="font-semibold">
          Name
        </label>
        <Input
          id="teeName"
          placeholder="e.g., RED"
          value={tee.name}
          onChange={(e) => onTeeChange({ ...tee, name: e.target.value })}
        />
      </div>

      {/* Distance Measurement */}
      <div className="space-y-2">
        <label className="font-semibold">Distance Measurement</label>
        <RadioGroup
          value={tee.distanceMeasurement}
          onValueChange={(val) =>
            onTeeChange({
              ...tee,
              distanceMeasurement: val as Tee["distanceMeasurement"],
            })
          }
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="meters" />
            <label className="!mt-0">meters</label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="yards" />
            <label className="!mt-0">yards</label>
          </div>
        </RadioGroup>
      </div>

      {/* Gender */}
      <div className="space-y-2">
        <label className="font-semibold">Men&apos;s/Ladies</label>
        <RadioGroup
          value={tee.gender}
          onValueChange={(val) =>
            onTeeChange({ ...tee, gender: val as Tee["gender"] })
          }
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="mens" />
            <label className="!mt-0">mens</label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="ladies" />
            <label className="!mt-0">ladies</label>
          </div>
        </RadioGroup>
      </div>
    </div>
  );
}

function TeeRatingFields({ tee, onTeeChange }: TeeFormContentProps) {
  const handleFront9RatingChange = (val: number) => {
    const newTee = { ...tee, courseRatingFront9: val };
    const back9 = tee.courseRatingBack9 || 0;
    newTee.courseRating18 = val + back9;
    onTeeChange(newTee);
  };

  const handleBack9RatingChange = (val: number) => {
    const newTee = { ...tee, courseRatingBack9: val };
    const front9 = tee.courseRatingFront9 || 0;
    newTee.courseRating18 = val + front9;
    onTeeChange(newTee);
  };

  const handleTotalRatingChange = (val: number) => {
    // Example logic that splits front/back 9 in half
    const half = val / 2;
    const newTee = {
      ...tee,
      courseRating18: val,
      courseRatingFront9: half,
      courseRatingBack9: half,
    };
    onTeeChange(newTee);
  };

  const handleFront9SlopeChange = (val: number) => {
    const newTee = { ...tee, slopeRatingFront9: val };
    const back9 = tee.slopeRatingBack9 || 0;
    newTee.slopeRating18 = Math.ceil((val + back9) / 2);
    onTeeChange(newTee);
  };

  const handleBack9SlopeChange = (val: number) => {
    const newTee = { ...tee, slopeRatingBack9: val };
    const front9 = tee.slopeRatingFront9 || 0;
    newTee.slopeRating18 = Math.ceil((front9 + val) / 2);
    onTeeChange(newTee);
  };

  const handleTotalSlopeChange = (val: number) => {
    // Example logic splitting into front/back
    const halfFront = Math.floor(val / 2);
    const halfBack = Math.ceil(val / 2);
    const newTee = {
      ...tee,
      slopeRating18: val,
      slopeRatingFront9: halfFront,
      slopeRatingBack9: halfBack,
    };
    onTeeChange(newTee);
  };

  return (
    <div className="space-y-4 pb-4">
      <Separator />
      <Large>Course Rating</Large>

      <div className="grid grid-cols-3 gap-4">
        {/* FRONT 9 */}
        <div className="space-y-2">
          <label className="font-semibold" htmlFor="courseRatingFrontNine">
            Front 9
          </label>
          <Input
            id="courseRatingFrontNine"
            type="number"
            step="0.1"
            value={tee.courseRatingFront9 === 0 ? "" : tee.courseRatingFront9}
            onChange={(e) =>
              handleFront9RatingChange(parseFloat(e.target.value) || 0)
            }
            placeholder="e.g., 39.5"
          />
        </div>

        {/* BACK 9 */}
        <div className="space-y-2">
          <label className="font-semibold" htmlFor="courseRatingBack9">
            Back 9
          </label>
          <Input
            id="courseRatingBack9"
            type="number"
            step="0.1"
            value={tee.courseRatingBack9 === 0 ? "" : tee.courseRatingBack9}
            onChange={(e) =>
              handleBack9RatingChange(parseFloat(e.target.value) || 0)
            }
            placeholder="e.g., 40.3"
          />
        </div>

        {/* TOTAL */}
        <div className="space-y-2">
          <label className="font-semibold" htmlFor="courseRating18">
            Total
          </label>
          <Input
            id="courseRating18"
            type="number"
            step="0.1"
            value={tee.courseRating18 === 0 ? "" : tee.courseRating18}
            onChange={(e) =>
              handleTotalRatingChange(parseFloat(e.target.value) || 0)
            }
            placeholder="e.g., 79.8"
          />
        </div>
      </div>

      <Large>Slope Rating</Large>
      <div className="grid grid-cols-3 gap-4">
        {/* FRONT 9 */}
        <div className="space-y-2">
          <label className="font-semibold" htmlFor="slopeRatingFront9">
            Front 9
          </label>
          <Input
            id="slopeRatingFront9"
            type="number"
            value={tee.slopeRatingFront9 === 0 ? "" : tee.slopeRatingFront9}
            onChange={(e) =>
              handleFront9SlopeChange(parseInt(e.target.value) || 0)
            }
            placeholder="e.g., 147"
          />
        </div>

        {/* BACK 9 */}
        <div className="space-y-2">
          <label className="font-semibold" htmlFor="slopeRatingBack9">
            Back 9
          </label>
          <Input
            id="slopeRatingBack9"
            type="number"
            value={tee.slopeRatingBack9 === 0 ? "" : tee.slopeRatingBack9}
            onChange={(e) =>
              handleBack9SlopeChange(parseInt(e.target.value) || 0)
            }
            placeholder="e.g., 149"
          />
        </div>

        {/* TOTAL */}
        <div className="space-y-2">
          <label className="font-semibold" htmlFor="slopeRating18">
            Total
          </label>
          <Input
            id="slopeRating18"
            type="number"
            value={tee.slopeRating18 === 0 ? "" : tee.slopeRating18}
            onChange={(e) =>
              handleTotalSlopeChange(parseInt(e.target.value) || 0)
            }
            placeholder="e.g., 148"
          />
        </div>
      </div>
    </div>
  );
}

function TeeHoleTable({ tee, onTeeChange }: TeeFormContentProps) {
  // Initialize holes array if it doesn't exist or has less than 18 holes
  const holes = useMemo(() => {
    const existingHoles = tee.holes || [];
    if (existingHoles.length === 18) return existingHoles;

    // Create an array of 18 holes, using existing holes where available
    return Array(18)
      .fill(null)
      .map((_, index) => ({
        holeNumber: index + 1,
        par: existingHoles[index]?.par || 0,
        hcp: existingHoles[index]?.hcp || 0,
        distance: existingHoles[index]?.distance || 0,
      }));
  }, [tee.holes]);

  const handleDistanceChange = (index: number, newDistance: number) => {
    const newHoles = [...holes];
    newHoles[index] = {
      ...newHoles[index],
      distance: newDistance,
      holeNumber: index + 1,
    };

    const outSum = newHoles
      .slice(0, 9)
      .reduce((acc, h) => acc + (h.distance || 0), 0);
    const inSum = newHoles
      .slice(9, 18)
      .reduce((acc, h) => acc + (h.distance || 0), 0);

    onTeeChange({
      ...tee,
      holes: newHoles,
      outDistance: outSum,
      inDistance: inSum,
      totalDistance: outSum + inSum,
    });
  };

  const handleParChange = (index: number, newPar: number) => {
    const newHoles = [...holes];
    newHoles[index] = {
      ...newHoles[index],
      par: newPar,
      holeNumber: index + 1,
    };

    const outPar = newHoles
      .slice(0, 9)
      .reduce((acc, h) => acc + (h.par || 0), 0);
    const inPar = newHoles
      .slice(9, 18)
      .reduce((acc, h) => acc + (h.par || 0), 0);

    onTeeChange({
      ...tee,
      holes: newHoles,
      outPar,
      inPar,
      totalPar: outPar + inPar,
    });
  };

  const handleHandicapChange = (index: number, newHcp: number) => {
    const newHoles = [...holes];
    newHoles[index] = {
      ...newHoles[index],
      hcp: newHcp,
      holeNumber: index + 1,
    };

    onTeeChange({
      ...tee,
      holes: newHoles,
    });
  };

  return (
    <div className="space-y-4">
      <Separator />
      <Large>Hole Information</Large>
      <div className="rounded-lg border max-w-[270px] sm:max-w-[350px] md:max-w-[600px] lg:max-w-[725px] xl:max-w-[975px] 2xl:max-w-[1225px] 3xl:max-w-[1600px]">
        <div className="overflow-x-auto max-w-full">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">Hole</TableHead>
                {holes.map((_, i) => (
                  <TableHead key={i} className="text-center">
                    {i + 1}
                  </TableHead>
                ))}
                <TableHead>Out</TableHead>
                <TableHead className="text-center">In</TableHead>
                <TableHead>Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* Distance row */}
              <TableRow>
                <TableCell className="font-medium">Distance</TableCell>
                {holes.map((hole, index) => (
                  <TableCell key={index} className="p-0 min-w-[50px]">
                    <Input
                      type="number"
                      className="border-0 text-center w-16 mx-1"
                      value={hole.distance === 0 ? "" : hole.distance}
                      onChange={(e) =>
                        handleDistanceChange(
                          index,
                          parseInt(e.target.value) || 0
                        )
                      }
                    />
                  </TableCell>
                ))}
                <TableCell>{tee.outDistance ?? 0}</TableCell>
                <TableCell>{tee.inDistance ?? 0}</TableCell>
                <TableCell>{tee.totalDistance ?? 0}</TableCell>
              </TableRow>

              {/* Par row */}
              <TableRow>
                <TableCell className="font-medium">Par</TableCell>
                {holes.map((hole, index) => (
                  <TableCell key={index} className="p-0">
                    <Input
                      type="number"
                      className="border-0 text-center w-16 mx-1"
                      value={hole.par === 0 ? "" : hole.par}
                      onChange={(e) =>
                        handleParChange(index, parseInt(e.target.value) || 0)
                      }
                    />
                  </TableCell>
                ))}
                <TableCell>{tee.outPar ?? 0}</TableCell>
                <TableCell>{tee.inPar ?? 0}</TableCell>
                <TableCell>{tee.totalPar ?? 0}</TableCell>
              </TableRow>

              {/* Handicap row */}
              <TableRow>
                <TableCell className="font-medium">Handicap</TableCell>
                {holes.map((hole, index) => (
                  <TableCell key={index} className="p-0">
                    <Input
                      type="number"
                      className="border-0 text-center w-16 mx-1"
                      value={hole.hcp === 0 ? "" : hole.hcp}
                      onChange={(e) =>
                        handleHandicapChange(
                          index,
                          parseInt(e.target.value) || 0
                        )
                      }
                    />
                  </TableCell>
                ))}
                <TableCell>N/A</TableCell>
                <TableCell>N/A</TableCell>
                <TableCell>N/A</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
