"use client";

import DarkModeToggle from "./DarkModeToggle";

interface HeaderProps {
    stars: number;
}

export default function Header({ stars }: HeaderProps) {
    return (
        <nav
            className="nav-bar flex justify-between items-center"
            style={{
                padding: "40px 100px 30px",
                zIndex: 10,
                position: "sticky",
                top: 0,
                background: "var(--nav-bg)",
                backdropFilter: "blur(12px)",
                WebkitBackdropFilter: "blur(12px)",
                transition: "background 0.3s ease",
            }}
        >
            <span
                className="font-light"
                style={{ fontSize: 22, lineHeight: "28px", color: "var(--text-primary)" }}
            >
                Context+
            </span>
            <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                <a
                    href="https://www.npmjs.com/package/contextplus"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center"
                >
                    <svg width="20" height="20" viewBox="0 0 256 256" fill="var(--icon-color)">
                        <path d="M0 256V0h256v256H0zm41-41h57.5V71.2H141V215h34V41H41v174z" />
                    </svg>
                </a>
                <a
                    href="https://github.com/ForLoopCodes/contextplus"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center"
                    style={{ gap: 8 }}
                >
                    <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="var(--icon-color)"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
                    </svg>
                    <span
                        className="font-light"
                        style={{ fontSize: 18, lineHeight: "24px", color: "var(--text-primary)" }}
                    >
                        {stars}
                    </span>
                </a>
                <DarkModeToggle />
            </div>
        </nav>
    );
}
