"use client";

import { useEffect, useState } from "react";

type TocItem = {
  id: string;
  title: string;
  level: 2 | 3;
};

type DocsTocProps = {
  items: TocItem[];
};

export function DocsToc({ items }: DocsTocProps) {
  const [activeId, setActiveId] = useState("");

  useEffect(() => {
    if (!items.length) return;

    const headings = items
      .map((item) => document.getElementById(item.id))
      .filter((element): element is HTMLElement => Boolean(element));

    if (!headings.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);

        if (visible[0]) {
          setActiveId(visible[0].target.id);
        }
      },
      {
        rootMargin: "-80px 0px -70% 0px",
      },
    );

    headings.forEach((heading) => observer.observe(heading));

    return () => observer.disconnect();
  }, [items]);

  if (!items.length) return null;

  return (
    <aside className="hidden w-56 shrink-0 xl:block">
      <div className="sticky top-24 py-10 pe-6">
        <p className="mb-3 text-sm font-semibold">On this page</p>

        <nav className="space-y-0.5 border-s">
          {items.map((item) => {
            const isActive = activeId === item.id;

            return (
              <a
                key={item.id}
                href={`#${item.id}`}
                className={[
                  "block border-s-2 -ms-px py-1.5 text-sm transition-colors",
                  item.level === 3 ? "ps-6" : "ps-4",
                  isActive
                    ? "border-foreground font-medium text-foreground"
                    : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
                ].join(" ")}
              >
                {item.title}
              </a>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
