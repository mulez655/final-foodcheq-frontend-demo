// js/animations.js
// Professional GSAP animations with safe fallbacks
(() => {
  // Fail safely if GSAP isn't loaded
  if (typeof window.gsap === "undefined") return;

  const gsap = window.gsap;
  const ScrollTrigger = window.ScrollTrigger;

  // Register ScrollTrigger if available
  if (ScrollTrigger) {
    gsap.registerPlugin(ScrollTrigger);
  }

  // Respect user preferences
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // =============================================
  // UTILITY: Safe animation wrapper
  // Elements remain visible even if animation fails
  // =============================================
  const safeAnimate = (elements, fromVars, toVars = {}) => {
    if (!elements || prefersReducedMotion) return;

    const targets = gsap.utils.toArray(elements);
    if (!targets.length) return;

    // Ensure elements are visible first
    gsap.set(targets, { visibility: "visible" });

    return gsap.fromTo(targets, fromVars, {
      duration: 0.8,
      ease: "power3.out",
      ...toVars,
    });
  };

  // =============================================
  // HEADLINE BAR - Slide down on load
  // =============================================
  const animateHeadlineBar = () => {
    const headlineBar = document.querySelector(".js-headline-bar");
    if (!headlineBar || prefersReducedMotion) return;

    gsap.fromTo(headlineBar,
      { y: -50, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.6, ease: "power2.out" }
    );
  };

  // =============================================
  // HEADLINE ROTATOR - Text carousel (mobile)
  // =============================================
  const headlineMessages = [
    "FREE SHIPPING AND RETURNS",
    "LIMITED TIME OFFER - SHOP NOW",
    "BECOME A PARTNER TODAY"
  ];

  const animateHeadlineRotator = () => {
    const textEl = document.getElementById("headlineText");
    if (!textEl || prefersReducedMotion) return;

    let currentIndex = 0;

    const rotateText = () => {
      gsap.to(textEl, {
        y: -15,
        opacity: 0,
        duration: 0.35,
        ease: "power2.in",
        onComplete: () => {
          currentIndex = (currentIndex + 1) % headlineMessages.length;
          textEl.textContent = headlineMessages[currentIndex];
          gsap.set(textEl, { y: 15 });
          gsap.to(textEl, {
            y: 0,
            opacity: 1,
            duration: 0.35,
            ease: "power2.out"
          });
        }
      });
    };

    setInterval(rotateText, 3500);
  };

  // =============================================
  // HERO SECTION - Staggered entrance
  // =============================================
  const animateHero = () => {
    const heroSection = document.querySelector("main > section:first-child");
    if (!heroSection || prefersReducedMotion) return;

    const badge = heroSection.querySelector(".inline-flex.rounded-full");
    const heading = heroSection.querySelector("h1");
    const paragraph = heroSection.querySelector("p.text-slate-600");
    const buttons = heroSection.querySelectorAll(".flex.gap-3 a, .flex.gap-3 button");
    const heroImage = heroSection.querySelector(".relative.rounded-3xl");

    const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

    // Left content - staggered fade up
    if (badge) {
      tl.fromTo(badge,
        { y: 30, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.6 },
        0.1
      );
    }

    if (heading) {
      tl.fromTo(heading,
        { y: 40, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.7 },
        0.2
      );
    }

    if (paragraph) {
      tl.fromTo(paragraph,
        { y: 30, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.6 },
        0.35
      );
    }

    if (buttons.length) {
      tl.fromTo(buttons,
        { y: 25, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.5, stagger: 0.1 },
        0.5
      );
    }

    // Hero image - scale and fade in
    if (heroImage) {
      tl.fromTo(heroImage,
        { opacity: 0, scale: 0.95 },
        { opacity: 1, scale: 1, duration: 0.9, ease: "power2.out" },
        0.2
      );
    }
  };

  // =============================================
  // SCROLL-TRIGGERED SECTIONS
  // =============================================
  const animateOnScroll = () => {
    if (!ScrollTrigger || prefersReducedMotion) return;

    // Section headers - fade up on scroll
    const sectionHeaders = document.querySelectorAll("section h2, section h3");
    sectionHeaders.forEach((header) => {
      gsap.fromTo(header,
        { y: 40, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.7,
          ease: "power2.out",
          scrollTrigger: {
            trigger: header,
            start: "top 85%",
            toggleActions: "play none none none",
          }
        }
      );
    });

    // Grid cards - staggered reveal
    const cardGrids = document.querySelectorAll(".grid.gap-6, .grid.gap-4");
    cardGrids.forEach((grid) => {
      const cards = grid.children;
      if (!cards.length) return;

      gsap.fromTo(cards,
        { y: 50, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.6,
          stagger: 0.12,
          ease: "power2.out",
          scrollTrigger: {
            trigger: grid,
            start: "top 80%",
            toggleActions: "play none none none",
          }
        }
      );
    });

    // Two-column layouts - fade up (no horizontal movement to avoid scrollbar)
    const twoColSections = document.querySelectorAll(".grid.lg\\:grid-cols-2");
    twoColSections.forEach((section) => {
      const leftCol = section.children[0];
      const rightCol = section.children[1];

      if (leftCol) {
        gsap.fromTo(leftCol,
          { y: 30, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.8,
            ease: "power2.out",
            scrollTrigger: {
              trigger: section,
              start: "top 75%",
              toggleActions: "play none none none",
            }
          }
        );
      }

      if (rightCol) {
        gsap.fromTo(rightCol,
          { y: 30, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.8,
            delay: 0.15,
            ease: "power2.out",
            scrollTrigger: {
              trigger: section,
              start: "top 75%",
              toggleActions: "play none none none",
            }
          }
        );
      }
    });

    // Featured products section
    const productsGrid = document.getElementById("homeProductsGrid");
    if (productsGrid) {
      // Use MutationObserver to animate products when they load
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.addedNodes.length) {
            const cards = productsGrid.querySelectorAll(":scope > div");
            gsap.fromTo(cards,
              { y: 40, opacity: 0, scale: 0.95 },
              {
                y: 0,
                opacity: 1,
                scale: 1,
                duration: 0.5,
                stagger: 0.15,
                ease: "back.out(1.2)",
              }
            );
          }
        });
      });

      observer.observe(productsGrid, { childList: true });
    }

    // CTA sections - subtle pulse/glow effect on scroll
    const ctaSections = document.querySelectorAll("section.bg-slate-900");
    ctaSections.forEach((cta) => {
      const content = cta.querySelector(".rounded-3xl");
      if (content) {
        gsap.fromTo(content,
          { y: 30, opacity: 0, scale: 0.98 },
          {
            y: 0,
            opacity: 1,
            scale: 1,
            duration: 0.8,
            ease: "power2.out",
            scrollTrigger: {
              trigger: cta,
              start: "top 80%",
              toggleActions: "play none none none",
            }
          }
        );
      }
    });

    // Video section
    const videoSection = document.querySelector(".aspect-video")?.closest("section");
    if (videoSection) {
      const videoContainer = videoSection.querySelector(".rounded-3xl");
      if (videoContainer) {
        gsap.fromTo(videoContainer,
          { y: 60, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.9,
            ease: "power2.out",
            scrollTrigger: {
              trigger: videoSection,
              start: "top 75%",
              toggleActions: "play none none none",
            }
          }
        );
      }
    }
  };

  // =============================================
  // BUTTON HOVER EFFECTS
  // =============================================
  const animateButtons = () => {
    if (prefersReducedMotion) return;

    document.querySelectorAll("a.rounded-xl, button.rounded-xl, a.rounded-2xl, button.rounded-2xl").forEach((btn) => {
      btn.addEventListener("mouseenter", () => {
        gsap.to(btn, {
          scale: 1.03,
          duration: 0.2,
          ease: "power2.out"
        });
      });

      btn.addEventListener("mouseleave", () => {
        gsap.to(btn, {
          scale: 1,
          duration: 0.2,
          ease: "power2.out"
        });
      });
    });
  };

  // =============================================
  // CARD HOVER EFFECTS
  // =============================================
  const animateCardHovers = () => {
    if (prefersReducedMotion) return;

    document.querySelectorAll(".rounded-2xl.border, .rounded-3xl.border").forEach((card) => {
      card.addEventListener("mouseenter", () => {
        gsap.to(card, {
          y: -5,
          boxShadow: "0 20px 40px -15px rgba(0,0,0,0.15)",
          duration: 0.3,
          ease: "power2.out"
        });
      });

      card.addEventListener("mouseleave", () => {
        gsap.to(card, {
          y: 0,
          boxShadow: "0 1px 3px 0 rgba(0,0,0,0.1)",
          duration: 0.3,
          ease: "power2.out"
        });
      });
    });
  };

  // =============================================
  // NAVBAR ANIMATION
  // =============================================
  const animateNavbar = () => {
    const navbar = document.getElementById("navbarMount");
    if (!navbar || prefersReducedMotion) return;

    // Wait for navbar to be injected
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.addedNodes.length) {
          const header = navbar.querySelector("header");
          if (header) {
            // Ensure header is visible first, then animate position only
            gsap.set(header, { visibility: "visible", opacity: 1 });
            gsap.from(header, {
              y: -20,
              duration: 0.5,
              ease: "power2.out"
            });
            observer.disconnect();
          }
        }
      });
    });

    observer.observe(navbar, { childList: true, subtree: true });
  };

  // =============================================
  // SMOOTH SCROLL INDICATOR (Optional)
  // =============================================
  const animateScrollProgress = () => {
    if (!ScrollTrigger || prefersReducedMotion) return;

    // Create scroll progress indicator
    const progressBar = document.createElement("div");
    progressBar.id = "scroll-progress";
    progressBar.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      height: 3px;
      background: linear-gradient(90deg, #059669, #10b981);
      transform-origin: left;
      transform: scaleX(0);
      z-index: 9999;
      pointer-events: none;
    `;
    document.body.appendChild(progressBar);

    gsap.to(progressBar, {
      scaleX: 1,
      ease: "none",
      scrollTrigger: {
        trigger: document.body,
        start: "top top",
        end: "bottom bottom",
        scrub: 0.3,
      }
    });
  };

  // =============================================
  // INITIALIZATION
  // =============================================
  const init = () => {
    // Immediate animations
    animateHeadlineBar();
    animateHeadlineRotator();
    animateNavbar();

    // Delayed for DOM content
    requestAnimationFrame(() => {
      animateHero();
      animateOnScroll();
      animateButtons();
      animateCardHovers();
      // animateScrollProgress(); // Disabled - was causing scrollbar flicker
    });

    // Safety fallback: ensure all elements are visible after animations should complete
    setTimeout(() => {
      document.querySelectorAll("header, main, section, img, h1, h2, h3, p, a, button, div").forEach(el => {
        if (el.style.opacity === "0" || getComputedStyle(el).opacity === "0") {
          el.style.opacity = "1";
        }
        if (el.style.visibility === "hidden") {
          el.style.visibility = "visible";
        }
      });
    }, 2000);
  };

  // Run once DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
