"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Large } from "../ui/typography";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { Separator } from "../ui/separator";
import { Hole, Tee } from "@/types/scorecard";
import { defaultTee } from "@/utils/scorecard/tee";

interface AddTeeDialogProps {
  onAdd: (newTee: Tee) => void;
}

export function AddTeeDialog({ onAdd }: AddTeeDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [newTee, setNewTee] = useState<Tee>(defaultTee);

  const handleAdd = () => {
    console.log(newTee);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="w-full">
          <Plus className="h-4 w-4 mr-2" />
          Add New Tee
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Tee</DialogTitle>
        </DialogHeader>
        <Alert>
          <TriangleAlert className="h-4 w-4" />{" "}
          <AlertTitle>Heads up!</AlertTitle>
          <AlertDescription>
            Enter <strong>18 hole values</strong> for the new tee even if you
            are adding a tee for a 9-hole course. You can choose to enter a
            9-hole round on this tee when you submit your scorecard. The course
            pro shop can help you find the correct information.
          </AlertDescription>
        </Alert>
        <div className="space-y-2 py-4">
          <div className="space-y-4 pb-4">
            <Separator />
            <Large>Tee Information</Large>
            <div className="space-y-2">
              <Label htmlFor="newTeeName">Name</Label>
              <Input
                id="newTeeName"
                value={newTee.name}
                onChange={(e) =>
                  setNewTee((prev) => ({
                    ...prev,
                    name: e.target.value.toUpperCase(),
                  }))
                }
                placeholder="e.g., RED"
              />
            </div>
            <div>
              <Label>Distance Measurement</Label>
              <RadioGroup
                defaultValue="meters"
                onValueChange={() => {
                  setNewTee((prev) => ({
                    ...prev,
                    distanceMeasurement:
                      prev.distanceMeasurement === "meters"
                        ? "yards"
                        : "meters",
                  }));
                }}
                className="mt-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="meters" id="r1" />
                  <Label htmlFor="r1">meters</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="yards" id="r2" />
                  <Label htmlFor="r2">yards</Label>
                </div>
              </RadioGroup>
            </div>
            <div>
              <Label>Men&apos;s/Ladies</Label>
              <RadioGroup
                defaultValue="mens"
                onValueChange={() => {
                  setNewTee((prev) => ({
                    ...prev,
                    gender: prev.gender === "mens" ? "ladies" : "mens",
                  }));
                }}
                className="mt-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="mens" id="r1" />
                  <Label htmlFor="r1">mens</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="ladies" id="r2" />
                  <Label htmlFor="r2">ladies</Label>
                </div>
              </RadioGroup>
            </div>
          </div>
          <div className="space-y-4 pb-4">
            <Separator />
            <Large>Course Rating</Large>
            <div className="grid grid-cols-3 gap-4 ">
              <div className="space-y-2">
                <Label htmlFor="courseRatingFrontNine">Front 9</Label>
                <Input
                  id="courseRatingFrontNine"
                  type="number"
                  step="0.1"
                  value={
                    newTee.courseRatingFront9 === 0
                      ? ""
                      : newTee.courseRatingFront9
                  }
                  onChange={(e) =>
                    setNewTee((prev) => ({
                      ...prev,
                      courseRatingFront9: parseFloat(e.target.value) || 0,
                      courseRating18:
                        parseFloat(e.target.value) + prev.courseRatingBack9 ||
                        0,
                    }))
                  }
                  placeholder="e.g., 39.5"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="courseRatingBackNine">Back 9</Label>
                <Input
                  id="courseRatingBackNine"
                  type="number"
                  step="0.1"
                  value={
                    newTee.courseRatingBack9 === 0
                      ? ""
                      : newTee.courseRatingBack9
                  }
                  onChange={(e) =>
                    setNewTee((prev) => ({
                      ...prev,
                      courseRatingBack9: parseFloat(e.target.value) || 0,
                      courseRating18:
                        parseFloat(e.target.value) + prev.courseRatingFront9 ||
                        0,
                    }))
                  }
                  placeholder="e.g., 40.3"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="courseRating18">Total</Label>
                <Input
                  id="courseRating18"
                  type="number"
                  step="0.1"
                  value={
                    newTee.courseRating18 === 0 ? "" : newTee.courseRating18
                  }
                  onChange={(e) => {
                    setNewTee((prev) => ({
                      ...prev,
                      courseRating18: parseFloat(e.target.value) || 0,
                      courseRatingFront9: parseFloat(e.target.value) / 2,
                      courseRatingBack9: parseFloat(e.target.value) / 2,
                    }));
                  }}
                  placeholder="e.g., 79.8"
                />
              </div>
            </div>
            <Large>Slope Rating</Large>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="slopeRatingFrontNine">Front 9</Label>
                <Input
                  id="slopeRatingFrontNine"
                  type="number"
                  value={
                    newTee.slopeRatingFront9 === 0
                      ? ""
                      : newTee.slopeRatingFront9
                  }
                  onChange={(e) =>
                    setNewTee((prev) => ({
                      ...prev,
                      slopeRatingFront9: parseInt(e.target.value) || 0,
                      slopeRating18:
                        (parseInt(e.target.value) + prev.slopeRatingBack9 ||
                          0) / 2,
                    }))
                  }
                  placeholder="e.g., 147"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="slopeRatingBackNine">Back 9</Label>
                <Input
                  id="slopeRatingBackNine"
                  type="number"
                  value={
                    newTee.slopeRatingBack9 === 0 ? "" : newTee.slopeRatingBack9
                  }
                  onChange={(e) => {
                    console.log(e.target.value);
                    setNewTee((prev) => ({
                      ...prev,
                      slopeRatingBack9: parseInt(e.target.value) || 0,
                      slopeRating18:
                        (parseInt(e.target.value) + prev.slopeRatingFront9 ||
                          0) / 2,
                    }));
                  }}
                  placeholder="e.g., 149"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="slopeRatingBackNine">Total</Label>
                <Input
                  id="slopeRating18"
                  type="number"
                  value={newTee.slopeRating18 === 0 ? "" : newTee.slopeRating18}
                  onChange={(e) =>
                    setNewTee((prev) => ({
                      ...prev,
                      slopeRating18: parseInt(e.target.value) || 0,
                      slopeRatingFront9: parseInt(e.target.value) / 2,
                      slopeRatingBack9: parseInt(e.target.value) / 2,
                    }))
                  }
                  placeholder="e.g., 148"
                />
              </div>
            </div>
          </div>
          <div className="space-y-4">
            <Separator />
            <Large>Hole Information</Large>
            <div className="overflow-x-auto max-w-[460px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">Hole</TableHead>
                    {Array.from({ length: 18 }, (_, i) => (
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
                  <TableRow>
                    <TableCell className="font-medium">Distance</TableCell>
                    {newTee?.holes?.map(({ distance }, index) => (
                      <TableCell key={index} className="p-0 min-w-[50px]">
                        <Input
                          type="number"
                          value={distance || ""}
                          onChange={(e) => {
                            const newHoles = [...newTee.holes!];
                            newHoles[index] = {
                              ...newHoles[index],
                              distance: parseInt(e.target.value) || 0,
                            };
                            const outDistance = newHoles
                              .slice(0, 9)
                              .reduce((acc, { distance }) => acc + distance, 0);
                            const inDistance = newHoles
                              .slice(9, 18)
                              .reduce((acc, { distance }) => acc + distance, 0);
                            const totalDistance = outDistance + inDistance;

                            setNewTee((prev) => ({
                              ...prev,
                              holes: newHoles,
                              outDistance,
                              inDistance,
                              totalDistance,
                            }));
                          }}
                          className="border-0 text-center w-16 mx-1"
                        />
                      </TableCell>
                    ))}
                    <TableCell>
                      {newTee?.holes
                        ?.slice(0, 9)
                        .reduce((acc, { distance }) => acc + distance, 0)}
                    </TableCell>
                    <TableCell>
                      {newTee.holes
                        ?.slice(9, 18)
                        .reduce((acc, { distance }) => acc + distance, 0)}
                    </TableCell>
                    <TableCell>
                      {newTee.holes
                        ?.slice(0, 18)
                        .reduce((acc, { distance }) => acc + distance, 0)}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Par</TableCell>
                    {newTee.holes?.map(({ par }, index) => (
                      <TableCell key={index} className="p-0">
                        <Input
                          type="number"
                          value={par || ""}
                          onChange={(e) => {
                            const newHoles = [...newTee.holes!];
                            newHoles[index] = {
                              ...newHoles[index],
                              par: parseInt(e.target.value) || 0,
                            };
                            const outPar = newHoles
                              .slice(0, 9)
                              .reduce((acc, { par }) => acc + par, 0);

                            const inPar = newHoles
                              .slice(9, 18)
                              .reduce((acc, { par }) => acc + par, 0);

                            const totalPar = newHoles.reduce(
                              (acc, { par }) => acc + par,
                              0
                            );
                            setNewTee((prev) => ({
                              ...prev,
                              holes: newHoles,
                              outPar,
                              inPar,
                              totalPar,
                            }));
                          }}
                          className="border-0 text-center w-16 mx-1"
                        />
                      </TableCell>
                    ))}
                    <TableCell>
                      {newTee.holes
                        ?.slice(0, 9)
                        .reduce((acc, { par }) => acc + par, 0)}
                    </TableCell>
                    <TableCell>
                      {newTee.holes
                        ?.slice(9, 18)
                        .reduce((acc, { par }) => acc + par, 0)}
                    </TableCell>
                    <TableCell>
                      {newTee.holes?.reduce((acc, { par }) => acc + par, 0)}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Handicap</TableCell>
                    {newTee.holes?.map(({ hcp }, index) => (
                      <TableCell key={index} className="p-0">
                        <Input
                          type="number"
                          value={hcp || ""}
                          onChange={(e) => {
                            const newHoles = [...newTee.holes!];
                            newHoles[index] = {
                              ...newHoles[index],
                              hcp: parseInt(e.target.value) || 0,
                            };
                            setNewTee((prev) => ({
                              ...prev,
                              holes: newHoles,
                            }));
                          }}
                          className="border-0 text-center w-16 mx-1"
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
        <div className="flex justify-end">
          <Button onClick={handleAdd}>Add Tee</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
