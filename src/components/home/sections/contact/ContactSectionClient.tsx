// src/components/home/sections/contact/ContactSectionClient.tsx
"use client";

import { useState } from "react";
import { motion } from "framer-motion";

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

type Props = {
  toEmail: string;
};

export default function ContactSectionClient({ toEmail }: Props) {
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const subject = encodeURIComponent(
      `Message from ${name || "Website visitor"}`
    );
    const body = encodeURIComponent(message);

    window.open(
      `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(
        toEmail
      )}&su=${subject}&body=${body}`,
      "_blank"
    );
  }

  return (
    <motion.section
      id="contact"
      initial={{ opacity: 0, y: 50 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7 }}
      viewport={{ once: true }}
      className="w-full min-h-screen flex items-center justify-center px-6 py-16 text-white"
    >
      <Card className="max-w-3xl w-full text-white bg-black/70 border border-white shadow-xl">
        <CardHeader className="text-center space-y-3">
          <CardTitle className="text-3xl sm:text-5xl font-bold">
            Let&apos;s Connect
          </CardTitle>

          <CardDescription className="text-sm sm:text-base text-white/80">
            Whether you&apos;re interested in collaborating, hiring, or just
            vibing with tech and design — reach out.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form
            onSubmit={handleSubmit}
            className="flex flex-col gap-4 items-stretch"
          >
            <div className="space-y-1 text-left max-w-md w-full mx-auto">
              <Label htmlFor="contact-name">Your name</Label>
              <Input
                id="contact-name"
                type="text"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.currentTarget.value)}
                required
                className="bg-gray-900/80 border-white/10 text-white"
              />
            </div>

            <div className="space-y-1 text-left max-w-md w-full mx-auto">
              <Label htmlFor="contact-message">Your message</Label>
              <Textarea
                id="contact-message"
                placeholder="What’s up?"
                value={message}
                onChange={(e) => setMessage(e.currentTarget.value)}
                rows={5}
                required
                className="bg-gray-900/80 border-white/10 text-white resize-none"
              />
            </div>

            <div className="flex justify-center pt-2">
              <Button type="submit" className="px-8 py-2 font-semibold">
                Send via Gmail
              </Button>
            </div>
          </form>
        </CardContent>

        <CardFooter className="justify-center">
          <p className="text-xs sm:text-sm text-white/60">
            Sending to:{" "}
            <span className="font-mono text-white/90">{toEmail}</span>
          </p>
        </CardFooter>
      </Card>
    </motion.section>
  );
}
