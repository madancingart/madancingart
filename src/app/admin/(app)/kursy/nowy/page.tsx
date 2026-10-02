import Link from "next/link";
import { CourseCreator } from "@/components/admin/courses/CourseCreator";

export const dynamic = "force-dynamic";

export default function NewCoursePage() {
  return (
    <div className="flex flex-col gap-4">
      <Link href="/admin/kursy" className="text-[13px] text-gold hover:text-gold-light">
        Wróć do listy
      </Link>
      <h1 className="text-[15px] font-semibold text-cream">Nowy kurs</h1>
      <CourseCreator />
    </div>
  );
}
