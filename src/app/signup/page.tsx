
"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createUserWithEmailAndPassword, sendEmailVerification, onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import { getAuthErrorMessage } from "@/lib/auth-errors";
import { Loader2 } from "lucide-react";
import Image from 'next/image';

export default function SignupPage() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [showVerificationDialog, setShowVerificationDialog] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setIsCheckingAuth(false);
      if (user && user.emailVerified) {
        router.push("/isogrid");
      }
    });

    return () => unsubscribe();
  }, [router]);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      if (userCredential.user) {
        await sendEmailVerification(userCredential.user);
        setShowVerificationDialog(true);
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Sign-up failed",
        description: getAuthErrorMessage(error.code),
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isCheckingAuth) {
    return (
      <main className="min-h-screen bg-[#151515] flex items-center justify-center">
        <div className="animate-pulse">
          <div className="h-12 w-12 rounded-lg bg-[#c5d86d]" />
        </div>
      </main>
    );
  }

  return (
    <>
      <main className="min-h-screen bg-[#151515] flex items-center justify-center overflow-hidden relative">
        {/* Animated Background */}
        <div className="fixed inset-0 -z-10 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-[#c5d86d]/10 rounded-full blur-3xl animate-pulse" />
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-[#c5d86d]/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: "1s" }} />
        </div>

        <div className="w-full max-w-md px-4 animate-in fade-in duration-500">
          <div className="mb-6 text-center">
            <Link href="/" className="inline-flex items-center gap-2 group mb-8">
            <Image 
              src="/icon.svg" 
              alt="Isogrid" 
              width={32} 
              height={32}
              className="group-hover:opacity-80 transition-opacity"
            />
              <span className="text-xl font-bold text-white group-hover:text-[#c5d86d] transition-colors">
                Isogrid
              </span>
            </Link>
          </div>

          <Card className="border-[#c5d86d]/20 bg-[#1a1a1a] backdrop-blur">
            <CardHeader>
              <CardTitle className="text-2xl text-white">Create Account</CardTitle>
              <CardDescription className="text-gray-400">
                Join Isogrid and start building your infinite workspace
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSignUp}>
                <div className="grid gap-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="grid gap-2">
                      <Label htmlFor="first-name" className="text-gray-300">First name</Label>
                      <Input 
                        id="first-name" 
                        placeholder="Max" 
                        required 
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        disabled={isLoading}
                        className="bg-[#151515] border-[#c5d86d]/20 text-white placeholder:text-gray-600 focus:border-[#c5d86d]/50 focus:ring-[#c5d86d]/20"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="last-name" className="text-gray-300">Last name</Label>
                      <Input 
                        id="last-name" 
                        placeholder="Robinson" 
                        required 
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        disabled={isLoading}
                        className="bg-[#151515] border-[#c5d86d]/20 text-white placeholder:text-gray-600 focus:border-[#c5d86d]/50 focus:ring-[#c5d86d]/20"
                      />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="email" className="text-gray-300">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="m@example.com"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={isLoading}
                      className="bg-[#151515] border-[#c5d86d]/20 text-white placeholder:text-gray-600 focus:border-[#c5d86d]/50 focus:ring-[#c5d86d]/20"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="password" className="text-gray-300">Password</Label>
                    <Input 
                      id="password" 
                      type="password" 
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={isLoading}
                      className="bg-[#151515] border-[#c5d86d]/20 text-white placeholder:text-gray-600 focus:border-[#c5d86d]/50 focus:ring-[#c5d86d]/20"
                    />
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full bg-[#c5d86d] text-[#151515] hover:bg-[#c5d86d]/90 font-semibold"
                    disabled={isLoading}
                  >
                    {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    {isLoading ? "Creating account..." : "Create Account"}
                  </Button>
                </div>
              </form>
              <div className="mt-6 text-center text-sm text-gray-400">
                Already have an account?{" "}
                <Link href="/login" className="text-[#c5d86d] hover:text-[#c5d86d]/80 transition-colors font-semibold">
                  Sign in
                </Link>
              </div>
            </CardContent>
          </Card>

          <p className="text-center text-gray-500 text-xs mt-6">
            By creating an account, you agree to our Terms of Service and Privacy Policy
          </p>
        </div>
      </main>

      <AlertDialog open={showVerificationDialog} onOpenChange={setShowVerificationDialog}>
        <AlertDialogContent className="border-[#c5d86d]/20 bg-[#1a1a1a]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Verify Your Email</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              A verification link has been sent to <strong>{email}</strong>. Please check your inbox and click the link to complete your registration.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction className="bg-[#c5d86d] text-[#151515] hover:bg-[#c5d86d]/90" onClick={() => router.push("/login")}>
              Proceed to Login
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
