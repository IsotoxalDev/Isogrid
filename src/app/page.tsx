"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { ChevronRight, Zap, Share2, Shield, Infinity } from "lucide-react";

const GRID_SIZE = 40;

export default function HomePage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  
  // Refs for direct DOM manipulation on scroll
  const gridRef = useRef(null);
  const blobsRef = useRef(null); // New ref for the glow container
  
  const router = useRouter();

  // Handle Authentication Check
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setIsLoading(false);
      if (user && user.emailVerified) {
        setIsLoggedIn(true);
      } else {
        setIsLoggedIn(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;

      if (gridRef.current) {
        gridRef.current.style.backgroundPosition = `0px -${scrollY * 0.5}px`;
      }

      if (blobsRef.current) {
        blobsRef.current.style.transform = `translate3d(0, -${scrollY}px, 0)`;
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  if (isLoading) {
    return (
      <main className="min-h-screen bg-[#151515] flex items-center justify-center">
        <div className="animate-pulse">
          <div className="h-12 w-12 rounded-lg bg-[#c5d86d]" />
        </div>
      </main>
    );
  }

  return (
    <main className="bg-transparent relative">
      {/* Solid Background */}
      <div className="fixed inset-0 -z-20 bg-[#151515]" />

      {/* Animated Background Blobs - Added Ref and styles for smooth movement */}
      <div 
        ref={blobsRef}
        className="fixed inset-0 -z-10 overflow-hidden pointer-events-none"
        style={{ willChange: 'transform' }} // Optimization hint for browser
      >
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-[#c5d86d]/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-[#c5d86d]/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: "1s" }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[#c5d86d]/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: "2s" }} />
      </div>

      {/* Grid Background - Position updated via Ref */}
      <div 
        ref={gridRef}
        className="fixed inset-0 -z-10"
        style={{
          backgroundImage: `radial-gradient(circle, #c5d86d 1px, transparent 1px)`,
          backgroundSize: `${GRID_SIZE}px ${GRID_SIZE}px`,
          backgroundPosition: '0px 0px',
          opacity: 0.35,
          pointerEvents: 'none',
          willChange: 'background-position',
        }}
      />

      {/* Vignette Shadow */}
      <div 
        className="fixed inset-0 -z-10 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse at center, transparent 0%, rgba(21, 21, 21, 0.7) 100%)`,
        }}
      />

      {/* Navigation */}
      <nav className="relative z-10 border-b border-[#c5d86d]/10 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
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
          <div className="flex items-center gap-3">
            {isLoggedIn ? (
              <Link href="/isogrid">
                <Button className="bg-[#c5d86d] text-[#151515] hover:bg-[#c5d86d]/90 font-semibold">
                  Enter App
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            ) : (
              <>
                <Link href="/login">
                  <Button
                    variant="outline"
                    className="border-[#c5d86d]/30 text-[#c5d86d] hover:bg-[#c5d86d]/10"
                  >
                    Login
                  </Button>
                </Link>
                <Link href="/signup">
                  <Button className="bg-[#c5d86d] text-[#151515] hover:bg-[#c5d86d]/90">
                    Get Started
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative z-10 h-screen w-full flex flex-col items-center justify-center">
        <div className="text-center space-y-6 animate-in fade-in duration-1000 max-w-4xl px-4 sm:px-6 lg:px-8">
          <h1 className="text-5xl sm:text-7xl font-bold text-white leading-tight">
            Your Infinite
            <span className="block text-[#c5d86d]">Digital Workspace</span>
          </h1>
          <p className="text-lg sm:text-xl text-gray-300 max-w-2xl mx-auto leading-relaxed">
            Create, organize, and manage your ideas on an infinite canvas. Pan, zoom, and explore without limits.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-8">
            {isLoggedIn ? (
              <Link href="/isogrid">
                <Button
                  size="lg"
                  className="bg-[#c5d86d] text-[#151515] hover:bg-[#c5d86d]/90 font-semibold text-base px-8"
                >
                  Open App
                  <ChevronRight className="w-5 h-5 ml-2" />
                </Button>
              </Link>
            ) : (
              <>
                <Link href="/signup">
                  <Button
                    size="lg"
                    className="bg-[#c5d86d] text-[#151515] hover:bg-[#c5d86d]/90 font-semibold text-base px-8"
                  >
                    Get Started Free
                    <ChevronRight className="w-5 h-5 ml-2" />
                  </Button>
                </Link>
                <Link href="/login">
                  <Button
                    size="lg"
                    variant="outline"
                    className="border-[#c5d86d]/30 text-[#c5d86d] hover:bg-[#c5d86d]/10 font-semibold text-base px-8"
                  >
                    Sign In
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="relative z-10 w-full px-4 sm:px-6 lg:px-8 py-32 bg-transparent">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16 space-y-4">
            <h2 className="text-4xl sm:text-5xl font-bold text-white">Powerful Features</h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
              Everything you need to bring your ideas to life
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <div
                key={index}
                className="group relative p-6 rounded-xl border border-[#c5d86d]/10 bg-[#1a1a1a]/50 backdrop-blur hover:border-[#c5d86d]/30 transition-all duration-300 hover:bg-[#1a1a1a]/80"
                style={{
                  animationDelay: `${index * 100}ms`,
                }}
              >
                <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-[#c5d86d]/0 to-[#c5d86d]/0 group-hover:from-[#c5d86d]/5 group-hover:to-[#c5d86d]/0 transition-all duration-300" />
                <div className="relative space-y-3">
                  <div className="w-12 h-12 rounded-lg bg-[#c5d86d]/10 flex items-center justify-center group-hover:bg-[#c5d86d]/20 transition-colors">
                    <feature.icon className="w-6 h-6 text-[#c5d86d]" />
                  </div>
                  <h3 className="text-xl font-semibold text-white">{feature.title}</h3>
                  <p className="text-gray-400 leading-relaxed">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative z-10 w-full px-4 sm:px-6 lg:px-8 py-32 bg-transparent">
        <div className="max-w-4xl mx-auto">
          <div className="rounded-2xl border border-[#c5d86d]/20 bg-gradient-to-br from-[#1a1a1a] to-[#151515] p-12 sm:p-16 text-center space-y-8">
            <h2 className="text-4xl sm:text-5xl font-bold text-white">
              Ready to get started?
            </h2>
            <p className="text-gray-300 text-lg max-w-2xl mx-auto">
              Start building your infinite workspace today. Organize your ideas, projects, and thoughts in one beautiful canvas.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              {isLoggedIn ? (
                <Link href="/isogrid">
                  <Button
                    size="lg"
                    className="bg-[#c5d86d] text-[#151515] hover:bg-[#c5d86d]/90 font-semibold text-base px-8"
                  >
                    Go to App
                    <ChevronRight className="w-5 h-5 ml-2" />
                  </Button>
                </Link>
              ) : (
                <>
                  <Link href="/signup">
                    <Button
                      size="lg"
                      className="bg-[#c5d86d] text-[#151515] hover:bg-[#c5d86d]/90 font-semibold text-base px-8"
                    >
                      Create Free Account
                      <ChevronRight className="w-5 h-5 ml-2" />
                    </Button>
                  </Link>
                  <Link href="/login">
                    <Button
                      size="lg"
                      variant="outline"
                      className="border-[#c5d86d]/30 text-[#c5d86d] hover:bg-[#c5d86d]/10 font-semibold text-base px-8"
                    >
                      Already have an account?
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-[#c5d86d]/10 mt-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <Image 
                src="/icon.svg" 
                alt="Isogrid" 
                width={32} 
                height={32}
              />
              <span className="text-white font-semibold">Isogrid</span>
            </div>
            <p className="text-gray-400 text-sm">
              © 2026 Isogrid. An infinite digital workspace.
            </p>
          </div>
        </div>
      </footer>
    </main>
  );
}

const features = [
  {
    icon: Infinity,
    title: "Infinite Canvas",
    description:
      "Unlimited space to organize and layout your ideas. Pan and zoom freely across your entire workspace.",
  },
  {
    icon: Zap,
    title: "Lightning Fast",
    description:
      "Instant responsiveness with real-time synchronization. No lag, no delays, just pure productivity.",
  },
  {
    icon: Share2,
    title: "Rich Organization",
    description:
      "Structure your content with flexible tools. Connect, group, and arrange items exactly how you want.",
  },
  {
    icon: Shield,
    title: "Secure",
    description:
      "Your data is protected with enterprise-grade security. Everything is encrypted and under your control.",
  },
  {
    icon: Infinity,
    title: "Rich Elements",
    description:
      "Add text, images, links, todos, boards, and arrows. Create complex workflows and visualizations.",
  },
  {
    icon: Zap,
    title: "Save Anywhere",
    description:
      "Auto-save to the cloud. Access your canvases from anywhere, anytime, on any device.",
  },
];

