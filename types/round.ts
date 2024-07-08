import z from "zod";

export const holeSchema = z.object({
    holeNumber: z.number().min(1).max(18),
    par: z.number().min(1).max(5),
    hcp: z.number().min(1).max(18),
    strokes: z.number().min(1).max(10),
})

export const roundSchema = z.object({
    numberOfHoles: z.number().min(1).max(18),
    holes: z.array(holeSchema),
    location: z.string(),
    date: z.date(),
    score: z.number().min(0),
    notes: z.string().optional(),
})

export type Hole = z.infer<typeof holeSchema>
export type Round = z.infer<typeof roundSchema>
