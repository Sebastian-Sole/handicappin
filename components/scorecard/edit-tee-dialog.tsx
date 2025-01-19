"use client"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Pencil } from 'lucide-react'
import { useState } from "react"

interface TeePosition {
  name: string
  scores: number[]
  handicaps: number[]
  courseRating: number
  slopeRating: number
}

interface EditTeeDialogProps {
  tee: TeePosition
  onSave: (updatedTee: TeePosition) => void
}

export function EditTeeDialog({ tee, onSave }: EditTeeDialogProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [editedTee, setEditedTee] = useState<TeePosition>({ ...tee })

  const handleSave = () => {
    onSave(editedTee)
    setIsOpen(false)
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Pencil className="h-4 w-4 mr-2" />
          Edit Tee
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Tee Information</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="teeName">Tee Name</Label>
            <Input
              id="teeName"
              value={editedTee.name}
              onChange={(e) =>
                setEditedTee((prev) => ({ ...prev, name: e.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Distances (Yards)</Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
              {editedTee.scores.map((score, index) => (
                <div key={index} className="space-y-1">
                  <Label htmlFor={`distance-${index}`}>Hole {index + 1}</Label>
                  <Input
                    id={`distance-${index}`}
                    type="number"
                    value={score}
                    onChange={(e) => {
                      const newScores = [...editedTee.scores]
                      newScores[index] = parseInt(e.target.value) || 0
                      setEditedTee((prev) => ({ ...prev, scores: newScores }))
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Handicaps</Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
              {editedTee.handicaps.map((handicap, index) => (
                <div key={index} className="space-y-1">
                  <Label htmlFor={`handicap-${index}`}>Hole {index + 1}</Label>
                  <Input
                    id={`handicap-${index}`}
                    type="number"
                    value={handicap}
                    onChange={(e) => {
                      const newHandicaps = [...editedTee.handicaps]
                      newHandicaps[index] = parseInt(e.target.value) || 0
                      setEditedTee((prev) => ({ ...prev, handicaps: newHandicaps }))
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="courseRating">Course Rating</Label>
            <Input
              id="courseRating"
              type="number"
              step="0.1"
              value={editedTee.courseRating}
              onChange={(e) =>
                setEditedTee((prev) => ({ ...prev, courseRating: parseFloat(e.target.value) || 0 }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="slopeRating">Slope Rating</Label>
            <Input
              id="slopeRating"
              type="number"
              value={editedTee.slopeRating}
              onChange={(e) =>
                setEditedTee((prev) => ({ ...prev, slopeRating: parseInt(e.target.value) || 0 }))
              }
            />
          </div>
        </div>
        <div className="flex justify-end">
          <Button onClick={handleSave}>Save Changes</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

