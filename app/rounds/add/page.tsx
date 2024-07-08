"use client"
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { roundSchema } from "@/types/round";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Calendar } from "@/components/ui/calendar"
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils"
import { format } from "date-fns"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useState } from "react";

const AddRoundPage = () => {
    const formSchema = roundSchema;
    const [numberOfHoles, setNumberOfHoles] = useState(9); // Default to 9 holes

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
    });

    function onSubmit(values: z.infer<typeof formSchema>) {
        console.log(values);
    }

    return (
        <div className="flex justify-center items-center h-full">
            <Card className="w-[70%]">
                <CardHeader>
                    <CardTitle>
                        Add Round
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                            <FormField
                                control={form.control}
                                name="date"
                                render={({ field }) => (
                                    <FormItem className="flex flex-col">
                                        <FormLabel>Tee Time</FormLabel>
                                        <FormControl>
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <FormControl>
                                                        <Button
                                                            variant={"outline"}
                                                            className={cn(
                                                                "w-[240px] pl-3 text-left font-normal",
                                                                !field.value && "text-muted-foreground"
                                                            )}
                                                        >
                                                            {field.value ? (
                                                                format(field.value, "PPP")
                                                            ) : (
                                                                <span>Pick a date</span>
                                                            )}
                                                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                        </Button>
                                                    </FormControl>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-auto p-0" align="start">
                                                    <Calendar
                                                        mode="single"
                                                        selected={field.value}
                                                        onSelect={field.onChange}
                                                        disabled={(date: any) =>
                                                            date > new Date() || date < new Date("1900-01-01")
                                                        }
                                                        initialFocus
                                                    />
                                                </PopoverContent>
                                            </Popover>
                                        </FormControl>
                                        <FormDescription>
                                            This is the date you played the round
                                        </FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="location"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Location</FormLabel>
                                        <FormControl>
                                            <Input {...field} />
                                        </FormControl>
                                        <FormDescription>
                                            Where did you play the round?
                                        </FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField control={form.control} name="numberOfHoles" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Number of Holes</FormLabel>
                                    <FormControl>
                                        <Select onValueChange={(value) => {
                                            field.onChange(Number(value));
                                            setNumberOfHoles(Number(value)); // Update the number of holes
                                        }} defaultValue={field.value && field.value.toString() || "9"}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder={9} />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="9">9 holes</SelectItem>
                                                <SelectItem value="18">18 holes</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </FormControl>
                                    <FormDescription>
                                        How many holes did you play?
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )} />

                            {/* For each hole, add a form field to register the attributes of the hole (an input for hole number, par, hcp and strokes) */}
                            {Array.from({ length: numberOfHoles }).map((_, index) => (
                                <div key={index} className="space-y-4">
                                    <FormField
                                        control={form.control}
                                        name={`holes[${index}].number`}
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Hole Number</FormLabel>
                                                <FormControl>
                                                    <Input type="number" {...field} value={index + 1} readOnly />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name={`holes[${index}].par`}
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Par</FormLabel>
                                                <FormControl>
                                                    <Input type="number" {...field} />
                                                </FormControl>
                                                <FormDescription>
                                                    Par for this hole
                                                </FormDescription>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name={`holes[${index}].hcp`}
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Handicap (HCP)</FormLabel>
                                                <FormControl>
                                                    <Input type="number" {...field} />
                                                </FormControl>
                                                <FormDescription>
                                                    Handicap for this hole
                                                </FormDescription>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name={`holes[${index}].strokes`}
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Strokes</FormLabel>
                                                <FormControl>
                                                    <Input type="number" {...field} />
                                                </FormControl>
                                                <FormDescription>
                                                    Number of strokes for this hole
                                                </FormDescription>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                            ))}

                            <Button type="submit">Submit</Button>
                        </form>
                    </Form>
                </CardContent>
                <CardFooter>
                    <Button>
                        Save
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}

export default AddRoundPage;
