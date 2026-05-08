import "dotenv/config";
import bcrypt from "bcrypt";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const saltRounds = Number(process.env.BCRYPT_SALT_ROUNDS ?? 10);

async function upsertUser(input: {
  username: string;
  email: string;
  password: string;
  fullName: string;
  role: "admin" | "teacher" | "student";
}) {
  const passwordHash = await bcrypt.hash(input.password, saltRounds);

  return prisma.user.upsert({
    where: { username: input.username },
    update: {
      email: input.email,
      passwordHash,
      fullName: input.fullName,
      role: input.role
    },
    create: {
      username: input.username,
      email: input.email,
      passwordHash,
      fullName: input.fullName,
      role: input.role
    }
  });
}

async function upsertSubject(id: number, name: string) {
  return prisma.subject.upsert({
    where: { id },
    update: { name },
    create: { id, name }
  });
}

async function upsertCourse(input: {
  id: number;
  subjectId: number;
  title: string;
  description: string;
  teacherName: string;
}) {
  return prisma.course.upsert({
    where: { id: input.id },
    update: input,
    create: input
  });
}

async function upsertLesson(input: {
  id: number;
  courseId: number;
  title: string;
  description: string;
  videoType: "youtube" | "google_drive";
  videoUrl: string;
  questions: {
    questionType: "multiple_choice" | "short_answer";
    content: string;
    optionA?: string;
    optionB?: string;
    optionC?: string;
    optionD?: string;
    correctAnswer: string;
  }[];
}) {
  await prisma.question.deleteMany({ where: { lessonId: input.id } });

  return prisma.lesson.upsert({
    where: { id: input.id },
    update: {
      courseId: input.courseId,
      title: input.title,
      description: input.description,
      videoType: input.videoType,
      videoUrl: input.videoUrl,
      isActive: true,
      questions: {
        create: input.questions.map((question) => ({
          questionType: question.questionType,
          content: question.content,
          optionA: question.optionA ?? null,
          optionB: question.optionB ?? null,
          optionC: question.optionC ?? null,
          optionD: question.optionD ?? null,
          correctAnswer: question.correctAnswer
        }))
      }
    },
    create: {
      id: input.id,
      courseId: input.courseId,
      title: input.title,
      description: input.description,
      videoType: input.videoType,
      videoUrl: input.videoUrl,
      questions: {
        create: input.questions.map((question) => ({
          questionType: question.questionType,
          content: question.content,
          optionA: question.optionA ?? null,
          optionB: question.optionB ?? null,
          optionC: question.optionC ?? null,
          optionD: question.optionD ?? null,
          correctAnswer: question.correctAnswer
        }))
      }
    }
  });
}

function addDays(days: number, hour = 19, minute = 30) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hour, minute, 0, 0);
  return date;
}

async function main() {
  await prisma.$transaction([
    prisma.scheduleItem.deleteMany(),
    prisma.notification.deleteMany(),
    prisma.studentLessonNote.deleteMany(),
    prisma.assignmentSubmission.deleteMany(),
    prisma.assignment.deleteMany(),
    prisma.studentLessonProgress.deleteMany(),
    prisma.learningPath.deleteMany(),
    prisma.lessonMaterial.deleteMany(),
    prisma.question.deleteMany(),
    prisma.lesson.deleteMany(),
    prisma.course.deleteMany(),
    prisma.subject.deleteMany(),
    prisma.streak.deleteMany(),
    prisma.studentProfile.deleteMany(),
    prisma.user.deleteMany()
  ]);

  const admin = await upsertUser({
    username: process.env.ADMIN_USERNAME ?? "admin",
    email: process.env.ADMIN_EMAIL ?? "admin@mindhub.test",
    password: process.env.ADMIN_PASSWORD ?? "Admin@12345",
    fullName: "MindHub Admin",
    role: "admin"
  });

  const teacherMath = await upsertUser({
    username: "teacher.math",
    email: "teacher.math@mindhub.test",
    password: "Teacher@123",
    fullName: "Nguyen Minh Khoa",
    role: "teacher"
  });

  const teacherScience = await upsertUser({
    username: "teacher.science",
    email: "teacher.science@mindhub.test",
    password: "Teacher@123",
    fullName: "Tran Ha Linh",
    role: "teacher"
  });

  const students = await Promise.all(
    [
      ["student.anh", "Anh Nguyen", "Lop 8"],
      ["student.binh", "Binh Tran", "Lop 9"],
      ["student.chi", "Chi Le", "Lop 10"],
      ["student.dat", "Dat Pham", "Lop 11"],
      ["student.em", "Em Hoang", "Lop 12"]
    ].map(([username, fullName], index) =>
      upsertUser({
        username,
        email: `${username}@mindhub.test`,
        password: "Student@123",
        fullName,
        role: "student"
      }).then((student) => ({ student, grade: ["Lop 8", "Lop 9", "Lop 10", "Lop 11", "Lop 12"][index] }))
    )
  );

  for (const { student, grade } of students) {
    await prisma.streak.upsert({
      where: { studentId: student.id },
      update: {},
      create: { studentId: student.id }
    });
    await prisma.studentProfile.upsert({
      where: { studentId: student.id },
      update: {
        grade,
        schoolName: "MindHub Online",
        learningGoals: "Nam chac kien thuc nen tang va duy tri thoi quen hoc moi tuan.",
        targetScore: "8.5+",
        preferredSubjects: "Toan,Vat ly,Hoa hoc"
      },
      create: {
        studentId: student.id,
        grade,
        schoolName: "MindHub Online",
        learningGoals: "Nam chac kien thuc nen tang va duy tri thoi quen hoc moi tuan.",
        targetScore: "8.5+",
        preferredSubjects: "Toan,Vat ly,Hoa hoc"
      }
    });
  }

  const math = await upsertSubject(1, "Toan");
  const physics = await upsertSubject(2, "Vat ly");
  const chemistry = await upsertSubject(3, "Hoa hoc");

  const courses = await Promise.all([
    upsertCourse({
      id: 1,
      subjectId: math.id,
      title: "Dai so THCS nen tang",
      description: "Phuong trinh, bien doi bieu thuc va cach trinh bay loi giai ro rang.",
      teacherName: teacherMath.fullName
    }),
    upsertCourse({
      id: 2,
      subjectId: physics.id,
      title: "Co hoc can ban",
      description: "Luc, chuyen dong va nang luong cho hoc sinh THCS/THPT.",
      teacherName: teacherScience.fullName
    }),
    upsertCourse({
      id: 3,
      subjectId: chemistry.id,
      title: "Hoa hoc nhap mon",
      description: "Can bang phuong trinh, mol va nhung quy tac nen tang.",
      teacherName: teacherScience.fullName
    })
  ]);

  const lessons = await Promise.all([
    upsertLesson({
      id: 1,
      courseId: courses[0].id,
      title: "Phuong trinh bac nhat",
      description: "Cach chuyen ve, rut gon va kiem tra nghiem cua phuong trinh bac nhat.",
      videoType: "youtube",
      videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      questions: [
        {
          questionType: "multiple_choice",
          content: "Neu 2x + 4 = 10 thi x bang bao nhieu?",
          optionA: "2",
          optionB: "3",
          optionC: "4",
          optionD: "5",
          correctAnswer: "B"
        },
        {
          questionType: "short_answer",
          content: "Giai nhanh: x - 7 = 5",
          correctAnswer: "12"
        }
      ]
    }),
    upsertLesson({
      id: 2,
      courseId: courses[0].id,
      title: "Ham so bac hai",
      description: "Nhan dien dang chuan va doc cac he so cua parabol.",
      videoType: "youtube",
      videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      questions: [
        {
          questionType: "multiple_choice",
          content: "Bieu thuc nao la ham bac hai?",
          optionA: "x + 1",
          optionB: "2x - 3",
          optionC: "x^2 + 3x + 2",
          optionD: "7",
          correctAnswer: "C"
        }
      ]
    }),
    upsertLesson({
      id: 3,
      courseId: courses[1].id,
      title: "Van toc va gia toc",
      description: "Doc do thi chuyen dong va tinh van toc trung binh.",
      videoType: "youtube",
      videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      questions: [
        {
          questionType: "multiple_choice",
          content: "Don vi SI cua van toc la gi?",
          optionA: "m/s",
          optionB: "N",
          optionC: "J",
          optionD: "kg",
          correctAnswer: "A"
        }
      ]
    }),
    upsertLesson({
      id: 4,
      courseId: courses[2].id,
      title: "Can bang phuong trinh hoa hoc",
      description: "Dat he so va bao toan so nguyen tu trong phan ung.",
      videoType: "youtube",
      videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      questions: [
        {
          questionType: "multiple_choice",
          content: "He so cua O2 trong 2H2 + O2 -> 2H2O la bao nhieu?",
          optionA: "1",
          optionB: "2",
          optionC: "3",
          optionD: "4",
          correctAnswer: "A"
        }
      ]
    })
  ]);

  for (const { student } of students) {
    await prisma.learningPath.deleteMany({ where: { studentId: student.id } });
    await prisma.learningPath.createMany({
      data: lessons.map((lesson, index) => ({
        studentId: student.id,
        lessonId: lesson.id,
        orderIndex: index + 1,
        assignedBy: index < 2 ? teacherMath.id : teacherScience.id
      }))
    });
  }

  await prisma.studentLessonProgress.deleteMany({
    where: { studentId: { in: students.slice(0, 3).map(({ student }) => student.id) } }
  });

  await prisma.studentLessonProgress.createMany({
    data: [
      {
        studentId: students[0].student.id,
        lessonId: lessons[0].id,
        completed: true,
        score: 2,
        totalQuestions: 2,
        completedAt: addDays(-2)
      },
      {
        studentId: students[1].student.id,
        lessonId: lessons[0].id,
        completed: true,
        score: 1,
        totalQuestions: 2,
        completedAt: addDays(-1)
      },
      {
        studentId: students[2].student.id,
        lessonId: lessons[2].id,
        completed: true,
        score: 1,
        totalQuestions: 1,
        completedAt: addDays(-3)
      }
    ]
  });

  const assignment1 = await prisma.assignment.upsert({
    where: { id: 1 },
    update: {
      title: "Bai tap phuong trinh bac nhat",
      description: "Trinh bay cac buoc bien doi, kiem tra nghiem va nop loi giai ngan gon.",
      type: "assignment",
      subjectId: math.id,
      courseId: courses[0].id,
      lessonId: lessons[0].id,
      deadline: addDays(5, 22, 0),
      maxScore: 10,
      createdBy: teacherMath.id,
      isPublished: true
    },
    create: {
      id: 1,
      title: "Bai tap phuong trinh bac nhat",
      description: "Trinh bay cac buoc bien doi, kiem tra nghiem va nop loi giai ngan gon.",
      type: "assignment",
      subjectId: math.id,
      courseId: courses[0].id,
      lessonId: lessons[0].id,
      deadline: addDays(5, 22, 0),
      maxScore: 10,
      createdBy: teacherMath.id,
      isPublished: true
    }
  });

  const assignment2 = await prisma.assignment.upsert({
    where: { id: 2 },
    update: {
      title: "Kiem tra nhanh chuyen dong",
      description: "Tra loi ngan ve van toc trung binh va don vi do.",
      type: "test",
      subjectId: physics.id,
      courseId: courses[1].id,
      lessonId: lessons[2].id,
      deadline: addDays(7, 22, 0),
      maxScore: 10,
      createdBy: teacherScience.id,
      isPublished: true
    },
    create: {
      id: 2,
      title: "Kiem tra nhanh chuyen dong",
      description: "Tra loi ngan ve van toc trung binh va don vi do.",
      type: "test",
      subjectId: physics.id,
      courseId: courses[1].id,
      lessonId: lessons[2].id,
      deadline: addDays(7, 22, 0),
      maxScore: 10,
      createdBy: teacherScience.id,
      isPublished: true
    }
  });

  await prisma.assignmentSubmission.upsert({
    where: { assignmentId_studentId: { assignmentId: assignment1.id, studentId: students[0].student.id } },
    update: {
      status: "submitted",
      answerText: "Em chuyen 4 sang ve phai, 2x = 6 nen x = 3.",
      submittedAt: addDays(-1)
    },
    create: {
      assignmentId: assignment1.id,
      studentId: students[0].student.id,
      status: "submitted",
      answerText: "Em chuyen 4 sang ve phai, 2x = 6 nen x = 3.",
      startedAt: addDays(-2),
      submittedAt: addDays(-1)
    }
  });

  await prisma.assignmentSubmission.upsert({
    where: { assignmentId_studentId: { assignmentId: assignment2.id, studentId: students[2].student.id } },
    update: {
      status: "graded",
      answerText: "Van toc trung binh bang quang duong chia thoi gian.",
      score: 9,
      feedback: "Loi giai dung, can ghi ro don vi.",
      submittedAt: addDays(-2),
      gradedAt: addDays(-1)
    },
    create: {
      assignmentId: assignment2.id,
      studentId: students[2].student.id,
      status: "graded",
      answerText: "Van toc trung binh bang quang duong chia thoi gian.",
      score: 9,
      feedback: "Loi giai dung, can ghi ro don vi.",
      startedAt: addDays(-3),
      submittedAt: addDays(-2),
      gradedAt: addDays(-1)
    }
  });

  for (const { student } of students) {
    await prisma.notification.deleteMany({ where: { studentId: student.id } });
    await prisma.scheduleItem.deleteMany({ where: { studentId: student.id } });

    await prisma.notification.createMany({
      data: [
        {
          studentId: student.id,
          title: "Lo trinh moi da san sang",
          content: "MindHub da cap nhat cac bai hoc Toan, Ly, Hoa trong tuan nay.",
          type: "path"
        },
        {
          studentId: student.id,
          title: "Nhac nhe nhiem vu",
          content: "Hoan thanh bai tap truoc han de giu tien do hoc tap on dinh.",
          type: "assignment"
        }
      ]
    });

    await prisma.scheduleItem.createMany({
      data: [
        {
          studentId: student.id,
          courseId: courses[0].id,
          lessonId: lessons[0].id,
          title: "Live coaching: phuong trinh bac nhat",
          startsAt: addDays(1),
          endsAt: addDays(1, 20, 30),
          location: "Google Meet MindHub"
        },
        {
          studentId: student.id,
          courseId: courses[1].id,
          lessonId: lessons[2].id,
          title: "Chua bai: van toc va gia toc",
          startsAt: addDays(3),
          endsAt: addDays(3, 20, 30),
          location: "Phong hoc MindHub"
        }
      ]
    });
  }

  console.log("Seed complete.");
  console.log(`Admin: ${admin.username} / ${process.env.ADMIN_PASSWORD ?? "Admin@12345"}`);
  console.log("Teachers: teacher.math, teacher.science / Teacher@123");
  console.log("Students: student.anh, student.binh, student.chi, student.dat, student.em / Student@123");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
