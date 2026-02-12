import { qtype } from "@prisma/client";
export const endUsers = [
    {
        type: 'Student',
        name: 'John Doe',
        email: 'john.doe@example.com',
        address: '123 Main Street',
        phone: '1234567890',
        grade: "90",
        password: 'hashed_password_1',
        educationBoardId: 1
    },
    {
        type: 'Teacher',
        name: 'Jane Smith',
        email: 'jane.smith@school.edu',
        address: '456 School Road',
        phone: '876543210',
        password: 'hashed_password_2',
        grade: "10",
        educationBoardId: 1

    },
    {
        type: 'Student',
        name: 'Alice Johnson',
        email: 'alice.johnson@example.com',
        address: '789 Mountain View',
        phone: '+0123456789',
        grade: "85",
        password: 'hashed_password_3',
        educationBoardId: 1
    },
    {
        type: 'Teacher',
        name: 'David Lee',
        email: 'david.lee@school.edu',
        address: '10 Elm Street',
        phone: '+9876543211',
        password: 'hashed_password_4', grade: "10",
        isVerified: true,
        educationBoardId: 1
    },
    {
        type: 'Student',
        name: 'Michael Brown',
        email: 'michael.brown@example.com',
        address: '42 Park Lane',
        phone: '+0987654321',
        grade: "10",
        password: 'hashed_password_5',
        educationBoardId: 1
    },
    {
        type: 'Teacher',
        name: 'Sarah Garcia',
        email: 'sarah.garcia@school.edu',
        address: '56 Oak Avenue',
        phone: '+9871234567',
        password: 'hashed_password_6',
        grade: "10",
        educationBoardId: 1
    },

];

export const salesmenData = [
    {
        name: "String",
        email: "String@unique",
        passwordHash: "String"
    },
    {
        name: "String",
        email: "String2@unique",
        passwordHash: "String"
    }
]

export const courses = [
    {
        name: "Calculus 101",
        rating: 4.8,
        comment: "Excellent course for beginners!",
        price: 39.99,
        currentPrice: 29.99,
        searchTags: ["Math", "Calculus", "Beginner"],
        mentorId: 1,
        grade: "1",
    },
    {
        name: "Advanced Essay Writing",
        rating: 4.5,
        comment: "Helped me improve my writing skills significantly.",
        price: 49.99,
        currentPrice: 49.99,
        searchTags: ["English", "Writing", "Advanced"],
        mentorId: 2,
        grade: "2",
    },
    {
        name: "Biology for Everyone",
        rating: 4.7,
        comment: "Engaging and informative course.",
        price: 24.99,
        currentPrice: 24.99,
        searchTags: ["Biology", "Science", "General"],
        mentorId: 2,
        grade: "5",

    }, {
        name: "Biology of dogs",
        rating: 4.7,
        comment: "Engaging and informative course.",
        price: 24.99,
        currentPrice: 24.99,
        searchTags: ["Biology", "Science", "General"],
        mentorId: 2,
        grade: "5",

    },
    {
        name: "Biology of cats",
        rating: 4.7,
        comment: "Engaging and informative course.",
        price: 24.99,
        currentPrice: 24.99,
        searchTags: ["Biology", "Science", "General"],
        mentorId: 2,
        grade: "5",

    },
];

export const doubts = [
    {
        description: "I'm having trouble understanding the concept of derivatives in calculus.",
        subject: "Math",
        topic: "Calculus",
        status: 0, userId: 1, mentorId: 1,
    },
    {
        description: "How do I write a strong thesis statement for my history essay?",
        subject: "History",
        topic: "Essay Writing",
        status: 1, userId: 2, mentorId: 2,
    },
    {
        description: "Can you explain the difference between mitosis and meiosis?",
        subject: "Biology",
        topic: "Cell Division",
        status: 2, userId: 1, mentorId: 2,
    },
];

export const mentorRatings = [
    {
        rating: 5.0,
        comment: "Excellent mentor! Very knowledgeable and patient.",
        userId: 1, mentorId: 2,
    },
    {
        rating: 4.8,
        comment: "Clear explanations and helpful feedback.",
        userId: 3, mentorId: 1,
    },
    {
        rating: 4.5,
        comment: "Great course structure and engaging sessions.",
        userId: 2, mentorId: 2,
    },
];

export const courseRatingsData = [
    {
        title: "Excellent Calculus Course",
        subject: "Math",
        averageRating: 4.8,
        coursesId: 1,
    },
    {
        title: "Great Writing Skills Improvement",
        subject: "English",
        averageRating: 4.7,
        coursesId: 2,
    },
    {
        title: "Engaging Biology for All Levels",
        subject: "Science",
        averageRating: 4.5,
        coursesId: 3,
    },
];

export const assignmentsData = [
    {
        subject: "Calculus 101",
        name: "Limits and Derivatives Practice Problems",
        deadLine: new Date("2024-07-15"), mentorId: 1, coursesId: 1,
    },
    {
        subject: "Advanced Essay Writing",
        name: "Argumentative Essay Outline",
        deadLine: new Date("2024-07-20"), mentorId: 2, coursesId: 2,
    },
    {
        subject: "Biology for Everyone",
        name: "Cell Division Quiz",
        deadLine: new Date("2024-07-10"), mentorId: 2, coursesId: 1,
    },
];

export const submissionsData = [
    {
        coursesId: 1,
        assignmentsId: 1,
        endUsersId: 1,
    },
    {
        coursesId: 2,
        assignmentsId: 2,
        endUsersId: 2,
    },
];

export const doubtResponsesData = [
    {
        response: "Here's a breakdown of the steps to solve the derivatives problem...",
        doubtId: 1,
        mentorId: 2,
    },
    {
        response: "I can help you improve your thesis statement by focusing on...",
        doubtId: 2,
        mentorId: 1,
    },
    {
        response: "The key to understanding mitosis is to differentiate between the...",
        doubtId: 3,
        mentorId: 2,
    },
];

export const lessonsData = [
    {
        coursesId: 1, section: "Week 1",
        title: "Introduction to Calculus",
        description: "Learn the basics of limits and derivatives.",
        resourceURL: "https://www.example.com/intro-to-calculus",
        playTime: 1800,
    },
    {
        coursesId: 1, section: "Week 1",
        title: "Solving Limit Problems",
        description: "Step-by-step guide to solving limit problems.",
        resourceURL: "https://www.example.com/solving-limit-problems",
        playTime: 2400,
    },
    {
        coursesId: 2, section: "Week 2",
        title: "Crafting a Strong Thesis Statement",
        description: "Strategies for writing clear and focused thesis statements.",
        resourceURL: "https://www.example.com/crafting-thesis-statement",
        playTime: 1500,
    },
    {
        coursesId: 2, section: "Week 2",
        title: "Structure and Elements of an Essay",
        description: "Building a strong essay structure with clear arguments.",
        resourceURL: "https://www.example.com/essay-structure-elements",
        playTime: 1800,
    },
    {
        coursesId: 3, section: "Unit 1",
        title: "The Cell: Basic Unit of Life",
        description: "Introduction to cell structure and function.",
        resourceURL: "https://www.example.com/the-cell-basic-unit",
        playTime: 1200,
    },
];

export const adminsData = [
    {
        name: "John Doe",
        email: "john.doe@example.com",
        password: "hashed_password_1",
    },
    {
        name: "Jane Smith",
        email: "jane.smith@example.com",
        password: "hashed_password_2",
    },
    {
        name: "Admin User",
        email: "admin@example.com",
        password: "hashed_password_3",
    },
];

export const offersData = [
    {
        details: "Get 20% off your first course!",
        terms: "Valid for new users only. Expires in 30 days.",
        start: new Date("2024-07-10"),
        end: new Date("2024-08-09"),
        offerCode: "FIRST20",
    },
    {
        details: "Free trial for 7 days!",
        terms: "No credit card required. Cancel anytime.",
        start: new Date("2024-07-15"),
        end: new Date("2024-07-22"),
        offerCode: "FREETRIAL",
    },
    {
        details: "Subscribe for a year and get 2 months free!",
        terms: "Limited-time offer. Applies to annual subscriptions.",
        start: new Date("2024-07-20"),
        end: new Date("2024-08-31"),
        offerCode: "YEARPLAN",
    },
];

export const bannersData = [
    { offerId: 1, },
    { offerId: 2, },
    { offerId: 3, },
];

export const mcqTestData = [
    {
        startTime: new Date("2024-07-25T09:00:00"),
        endTime: new Date("2024-07-25T10:00:00"),
        mentorId: 1,
        coursesId: 1,
    },
    {
        startTime: new Date("2024-07-28T14:00:00"),
        endTime: new Date("2024-07-28T15:00:00"),
        mentorId: 2,
        coursesId: 2,
    },
    {
        startTime: new Date("2024-08-01T11:00:00"),
        endTime: new Date("2024-08-01T12:00:00"),
        mentorId: 2,
        coursesId: 1,
    },
];

export const mcqData = [
    {
        mcqTestId: 1, option1: "This is option 1",
        option2: "This is option 2 (correct)",
        option3: "This is option 3",
        option4: "This is option 4",
        answer: 2,
    },
    {
        mcqTestId: 1, option1: "Another option 1",
        option2: "Another option 2",
        option3: "Another option 3 (incorrect)",
        option4: "Another option 4",
        answer: 1,
    },
    {
        mcqTestId: 2, option1: "Question 2 option 1",
        option2: "Question 2 option 2",
        option3: "Question 2 option 3 (incorrect)",
        option4: "Question 2 option 4",
        answer: 4,
    },
    {
        mcqTestId: 2, option1: "Question 3 option 1",
        option2: "Question 3 option 2 (incorrect)",
        option3: "Question 3 option 3",
        option4: "Question 3 option 4",
        answer: 3,
    },
];

export const mcqResponsesData = [
    {
        mcqTestId: 1,
        mcqId: 1,
        endUsersId: 1,
        response: 2,
    },
    {
        mcqTestId: 1,
        mcqId: 2,
        endUsersId: 2,
        response: 1,
    },
];

export const mentors = [
    {
        name: 'Alice Walker',
        email: 'alice.walker@mentors.com',
        address: '123 Knowledge Way',
        searchTags: 'Math, Physics',
        languages: 'English, Spanish',
        dateOfBirth: new Date('1970-01-01'), phone: '1234567890',
        studentCount: 0, doubtsSolved: 0, averageRating: 0.0,
        qualifications: {
            create: [
                {
                    name: 'Master of Science in Mathematics',
                    level: 'Graduate',
                    institution: 'University of Knowledge',
                    year: new Date('2005-05-30'),
                },
                {
                    name: 'Teaching Certificate (Secondary Math)',
                    level: 'Professional',
                    institution: 'State Department of Education',
                    year: new Date('2006-06-15'),
                },
            ]
        },
    },
    {
        name: 'Dr. Michael Brown',
        email: 'michael.brown@mentors.com',
        address: '42 Park Lane',
        searchTags: 'Chemistry, Biology',
        languages: 'English, French',
        dateOfBirth: new Date('1965-07-14'), phone: '+0987654321',
        studentCount: 25, doubtsSolved: 100, averageRating: 4.8,
        qualifications: {
            create: [
                {
                    name: 'Ph.D. in Chemistry',
                    level: 'Doctoral',
                    institution: 'Institute of Technology',
                    year: new Date('2002-12-31'),
                },
                {
                    name: 'Certified High School Chemistry Teacher',
                    level: 'Professional',
                    institution: 'National Board for Professional Teaching Standards',
                    year: new Date('2003-08-01'),
                },
            ],
        },
    },

];

export const notificationsData = [
    {
        content: "Your assignment for Calculus has been graded!",
        userType: 0,
        targetId: "1",
    },
    {
        content: "A new lesson on derivatives has been uploaded!",
        userType: 0,
        targetId: "2",
    },
    {
        content: "Your child has a new doubt in the English course.",
        userType: 1,
        targetId: "3",
    },
];

export const leadsData = [
    {
        salesmanId: 1, coursesId: 1,
        leadInfo: "",
        targetPhone: ""
    },
    {
        salesmanId: 2, coursesId: 2,
        leadInfo: "",
        targetPhone: ""
    },
    {
        salesmanId: 2, coursesId: 2,
        leadInfo: "",
        targetPhone: ""
    },
];

export const purchases = [
    {
        id: 0,
        endUsersId: 1,
        coursesId: 1,
        modifiedOn: new Date(),
        createdOn: new Date(),
    },
    {
        id: 1,
        endUsersId: 2,
        coursesId: 2,
        modifiedOn: new Date(),
        createdOn: new Date(),
    },
];

export const educationBoards = [
    { name: 'National Education Board', country: 'USA' },
    { name: 'International Education Board', country: 'UK' },
    { name: 'Regional Education Board', country: 'Canada' }
];

export const subjects = [
    { name: 'Mathematics', code: 'MATH101', description: 'Basic Mathematics', educationBoardId: 1, gradeLevel: 1 },
    { name: 'Science', code: 'SCI101', description: 'Basic Science', educationBoardId: 1, gradeLevel: 1 },
    { name: 'History', code: 'HIST101', description: 'World History', educationBoardId: 2, gradeLevel: 1 },
    { name: 'cs', code: 'CS101', description: 'World History', educationBoardId: 1, gradeLevel: 1 },
    { name: 'hs', code: 'HS101', description: 'home science', educationBoardId: 1, gradeLevel: 1 },
    { name: 'sample', code: 'sample', description: 'sample', educationBoardId: 1, gradeLevel: 1 },
];

export const chapters = [
    { number: 1, title: 'Introduction to Mathematics', subjectId: 1, learningObjectives: ['Basic concepts'], estimatedDuration: 60 },
    { number: 2, title: 'Algebra', subjectId: 1, learningObjectives: ['Understanding algebraic expressions'], estimatedDuration: 90 },
    { number: 1, title: 'Introduction to Science', subjectId: 2, learningObjectives: ['Scientific method'], estimatedDuration: 60 }
];

export const topics = [
    { name: 'Basic Concepts', chapterId: 1, description: 'Introduction to basic mathematical concepts', content: 'Content for basic concepts' },
    { name: 'Algebraic Expressions', chapterId: 2, description: 'Detailed study of algebraic expressions', content: 'Content for algebraic expressions' },
    { name: 'Scientific Method', chapterId: 3, description: 'Understanding the scientific method', content: 'Content for scientific method' }
];


export const subscriptionData = [
    {
        endUsersId: 1, // Existing user ID
        ltCoursesId: 1,
        status: true,
        endDate: new Date('2024-12-31T00:00:00Z')
    },
    {
        endUsersId: 2, // Existing user ID
        ltCoursesId: 2,
        status: false,
        endDate: new Date('2024-11-30T00:00:00Z')
    },
    {
        endUsersId: 2, // Existing user ID
        ltCoursesId: 2,
        status: true,
        endDate: new Date('2024-10-15T00:00:00Z')
    },
    {
        endUsersId: 2, // Existing user ID
        ltCoursesId: 1,
        status: false,
        endDate: new Date('2024-09-20T00:00:00Z')
    },
    {
        endUsersId: 1, // Existing user ID
        ltCoursesId: 2,
        status: true,
        endDate: new Date('2024-08-25T00:00:00Z')
    }
];

export const ltCoursesData = [
    {
        name: 'Math 101',
        description: 'Basic Math Course',
        searchTags: ['math', 'algebra', 'basic'],
        price: 100,
        currentPrice: 80,
        averageRating: 4.5,
        subjectId: 2,
        duration: 30,
        grade: '1',
        mentorId: 1,
        category: 'Mathematics',
        level: 'Beginner',
        enrolledStudents: 50,
        thumbnailUrl: 'http://example.com/thumb1.jpg',
        isActive: true,
        language: 'English',
        prerequisites: ['Basic arithmetic'],
        syllabus: ['Introduction', 'Basic Concepts', 'Algebra']
    },
    {
        name: 'Science 101',
        description: 'Basic Science Course',
        searchTags: ['science', 'physics', 'basic'],
        price: 120,
        currentPrice: 90,
        averageRating: 4.7,
        duration: 35,
        subjectId: 1,
        grade: '1',
        mentorId: 2, // Existing mentor ID
        category: 'Science',
        level: 'Beginner',
        enrolledStudents: 40,
        thumbnailUrl: 'http://example.com/thumb2.jpg',
        isActive: true,
        language: 'English',
        prerequisites: ['Basic scientific knowledge'],
        syllabus: ['Introduction', 'Basic Physics', 'Experiments']
    },
    { name: 'history 101', description: 'Basic Science Course', searchTags: ['science', 'physics', 'basic'], price: 120, currentPrice: 90, averageRating: 4.7, duration: 35, subjectId: 3, grade: '1', mentorId: 2, category: 'Science', level: 'Beginner', enrolledStudents: 40, thumbnailUrl: 'http://example.com/thumb2.jpg', isActive: true, language: 'English', prerequisites: ['Basic scientific knowledge'], syllabus: ['Introduction', 'Basic Physics', 'Experiments'] },
    { name: 'CS 101', description: 'Basic Science Course', searchTags: ['science', 'physics', 'basic'], price: 120, currentPrice: 90, averageRating: 4.7, duration: 35, subjectId: 4, grade: '1', mentorId: 2, category: 'Science', level: 'Beginner', enrolledStudents: 40, thumbnailUrl: 'http://example.com/thumb2.jpg', isActive: true, language: 'English', prerequisites: ['Basic scientific knowledge'], syllabus: ['Introduction', 'Basic Physics', 'Experiments'] },
];

export const scheduleData = [
    {
        courseId: 1, // Existing course ID
        dayOfWeek: 'Monday',
        startTime: new Date('2024-07-08T09:00:00Z'),
        endTime: new Date('2024-07-08T10:30:00Z'),
        createdOn: new Date(),
        modifiedOn: new Date()
    },
    {
        courseId: 1, // Existing course ID
        dayOfWeek: 'Wednesday',
        startTime: new Date('2024-07-10T09:00:00Z'),
        endTime: new Date('2024-07-10T10:30:00Z'),
        createdOn: new Date(),
        modifiedOn: new Date()
    },
    {
        courseId: 2, // Existing course ID
        dayOfWeek: 'Tuesday',
        startTime: new Date('2024-07-09T11:00:00Z'),
        endTime: new Date('2024-07-09T12:30:00Z'),
        createdOn: new Date(),
        modifiedOn: new Date()
    },
    {
        courseId: 2, // Existing course ID
        dayOfWeek: 'Thursday',
        startTime: new Date('2024-07-11T11:00:00Z'),
        endTime: new Date('2024-07-11T12:30:00Z'),
        createdOn: new Date(),
        modifiedOn: new Date()
    }
];

export const reviewData = [
    {
        courseId: 1, // Existing course ID
        rating: 4.5,
        comment: 'Great course!',
        createdOn: new Date()
    },
    {
        courseId: 1, // Existing course ID
        rating: 4.0,
        comment: 'Very informative.',
        createdOn: new Date()
    },
    {
        courseId: 2, // Existing course ID
        rating: 4.8,
        comment: 'Loved the experiments!',
        createdOn: new Date()
    },
    {
        courseId: 2, // Existing course ID
        rating: 4.7,
        comment: 'Excellent introduction to physics.',
        createdOn: new Date()
    }
];

export const bigCourseData = [
    {
        name: 'Course 1',
        description: 'Description for Course 1',
        price: 100.0,
        currentPrice: 80.0,
        averageRating: 4.5,
        duration: 10.0,
        thumbnailUrl: 'https://example.com/thumbnail1.jpg',
        language: 'English',
        enrolledStudents: 150,
        isActive: true,
        createdOn: new Date('2024-01-01T00:00:00Z'),
        modifiedOn: new Date('2024-01-01T00:00:00Z'),
        grade: '1',
        mentorList: [],
        subjectList: []
    },
    {
        name: 'Course 2',
        description: 'Description for Course 2',
        price: 200.0,
        currentPrice: 180.0,
        averageRating: 4.8,
        duration: 15.0,
        thumbnailUrl: 'https://example.com/thumbnail2.jpg',
        language: 'Spanish',
        enrolledStudents: 200,
        isActive: true,
        createdOn: new Date('2024-01-02T00:00:00Z'),
        modifiedOn: new Date('2024-01-02T00:00:00Z'),
        grade: '2',
        mentorList: [],
        subjectList: []
    },
    {
        name: 'Course 3',
        description: 'Description for Course 3',
        price: 300.0,
        currentPrice: 250.0,
        averageRating: 4.7,
        duration: 20.0,
        thumbnailUrl: 'https://example.com/thumbnail3.jpg',
        language: 'French',
        enrolledStudents: 300,
        isActive: true,
        createdOn: new Date('2024-01-03T00:00:00Z'),
        modifiedOn: new Date('2024-01-03T00:00:00Z'),
        grade: '3',
        mentorList: [],
        subjectList: []
    }
]

export const bigCourseSubscriptionData = [
    {
        endUsersId: 1,
        bigCourseId: 1,
        PurchasePrice: 100,
        cgst: 100.0,
        sgst: 100.0,
        basePrice: 1000,
        discount: 5,
        createdAt: new Date('2024-01-10T00:00:00Z'),
        updatedAt: new Date('2024-01-10T00:00:00Z')
    },
    {
        endUsersId: 1,
        bigCourseId: 2,
        PurchasePrice: 100,
        cgst: 100.0,
        sgst: 100.0,
        basePrice: 1000,
        discount: 5,
        createdAt: new Date('2024-01-11T00:00:00Z'),
        updatedAt: new Date('2024-01-11T00:00:00Z')
    },
    {
        endUsersId: 1,
        bigCourseId: 3,
        PurchasePrice: 100,
        cgst: 100.0,
        sgst: 100.0,
        basePrice: 1000,
        discount: 5,
        createdAt: new Date('2024-01-12T00:00:00Z'),
        updatedAt: new Date('2024-01-12T00:00:00Z')
    }
]

export const BigCourseSessionsData = [
    {
        detail: 'Session 1 details',
        startTime: new Date('2024-01-20T09:00:00Z'),
        duration: 30,
        mentorId: 1,
        bigCourseId: 1,
        endTime: new Date('2024-01-20T09:30:00Z')
    },
    {
        detail: 'Session 2 details',
        startTime: new Date('2024-01-21T10:00:00Z'),
        duration: 45,
        mentorId: 2,
        bigCourseId: 2,
        endTime: new Date('2024-01-21T10:45:00Z')
    },
    {
        detail: 'Session 3 details',
        startTime: new Date('2024-01-22T11:00:00Z'),
        duration: 60,
        mentorId: 1,
        bigCourseId: 3,
        endTime: new Date('2024-01-22T12:00:00Z')
    },
    {
        detail: 'Session 3 details',
        startTime: new Date('2024-01-22T11:00:00Z'),
        duration: 60,
        mentorId: 1,
        bigCourseId: 1,
        endTime: new Date('2024-01-22T12:00:00Z')
    }
]

export const sessionTestData = [
    {
        startTime: new Date('2024-01-25T09:00:00Z'),
        endTime: new Date('2024-01-25T09:30:00Z'),
        mentorId: 1,
        duration: 30,
        sessionId: 1
    },
    {
        startTime: new Date('2024-01-26T10:00:00Z'),
        endTime: new Date('2024-01-26T10:30:00Z'),
        mentorId: 1,
        duration: 30,
        sessionId: 2
    },
    {
        startTime: new Date('2024-01-27T11:00:00Z'),
        endTime: new Date('2024-01-27T11:30:00Z'),
        mentorId: 1,
        duration: 30,
        sessionId: 1
    }
]


export const sessionTestQuestionData = [
    {
        sessionTestId: 1,
        type: qtype.multipleChoice,
        question: "question one id 1",
        option1: 'Option 1A',
        option2: 'Option 1B',
        option3: 'Option 1C',
        option4: 'Option 1D',
        correctResponse: 1
    },
    {
        sessionTestId: 2,
        question: "question 2 id 2",
        type: qtype.trueFalse,
        option1: 'True',
        option2: 'False',
        correctResponse: 1
    },
    {
        sessionTestId: 2,
        question: "question 3 id 3",
        type: qtype.multipleChoice,
        option1: 'Option 3A',
        option2: 'Option 3B',
        option3: 'Option 3C',
        option4: 'Option 3D',
        correctResponse: 2
    }
]

export const sessionTestSubmissionsData = [
    {
        sessionTestId: 1,
        endUsersId: 1,
    },
    {
        sessionTestId: 2,
        endUsersId: 2,
    },
];

export const sessionTestResponseData = [
    {
        sessionTestQuestionId: 1,
        sessionTestSubmissionId: 1,
        sessionTestId: 1,
        endUsersId: 1,
        response: 1
    },
    {
        sessionTestQuestionId: 2,
        sessionTestSubmissionId: 2,
        sessionTestId: 2,
        endUsersId: 1,
        response: 0
    },
    {
        sessionTestQuestionId: 3,
        sessionTestId: 2,
        endUsersId: 1,
        sessionTestSubmissionId: 1,
        response: 2
    }
]

export const sessions = [
    {
        detail: 'Session 1 details',
        subjectId: 1,
        isDone: false,
        duration: 30,
        mentorId: 1,
        bigCourseId: 1,
        startTime: new Date('2024-01-20T09:00:00Z'),
        endTime: new Date('2024-01-20T09:30:00Z')
    },
    {
        detail: 'Session 2 details',
        isDone: true,
        subjectId: 1,
        duration: 45,
        mentorId: 2,
        bigCourseId: 1,
        startTime: new Date('2024-01-21T10:00:00Z'),
        endTime: new Date('2024-01-21T10:45:00Z')
    },
    {
        detail: 'Session 3 details',
        isDone: false,
        subjectId: 1,
        duration: 60,
        mentorId: 2,
        bigCourseId: 1,
        startTime: new Date('2024-01-22T11:00:00Z'),
        endTime: new Date('2024-01-22T12:00:00Z')
    }
]

export const BgCourseReviewData = [
    {
        bigCourseId: 1,
        endUsersId: 1,
        rating: 4.5,
        comment: 'Great course!',
        createdOn: new Date('2024-02-01T00:00:00Z')
    },
    {
        bigCourseId: 2,
        endUsersId: 1,
        rating: 4.8,
        comment: 'Very informative!',
        createdOn: new Date('2024-02-02T00:00:00Z')
    },
    {
        bigCourseId: 3,
        endUsersId: 1,
        rating: 4.7,
        comment: 'Loved the content!',
        createdOn: new Date('2024-02-03T00:00:00Z')
    }
]

export const TeahcerComments = [
    {
        mentorId: 1,
        subjectId: 1,
        bigCourseId: 1,
        comment: 'This is a comment for TeachIntro 1'
    },
    {
        mentorId: 2,
        subjectId: 2,
        bigCourseId: 1,
        comment: 'This is a comment for TeachIntro 2'
    }
]

export const attendanceRecord = [
    {
        endUsersId: 1,
        bigCourseId: 1,
        sessionId: 1
    },
    {
        endUsersId: 1,
        bigCourseId: 1,
        sessionId: 2
    },
    {
        endUsersId: 2,
        bigCourseId: 1,
        sessionId: 1
    }
]

export const ctestData = [
    {
        title: 'Test 1',
        endDate: new Date('2024-01-20T09:00:00Z'),
        startDate: new Date('2024-01-20T09:00:00Z'),
        Duration: 30,
        bigCourseId: 1,
        subjectId: 1,
        mentorId: 1
    },
    {
        title: 'Test 2',
        endDate: new Date('2024-01-21T10:00:00Z'),
        startDate: new Date('2024-01-20T09:00:00Z'),
        Duration: 30,
        bigCourseId: 1,
        subjectId: 1,
        mentorId: 1
    },
    {
        title: 'Test 3',
        endDate: new Date('2024-01-22T11:00:00Z'),
        startDate: new Date('2024-01-20T09:00:00Z'),
        Duration: 30,
        bigCourseId: 1,
        subjectId: 1,
        mentorId: 1
    }
];

export const ctestQuestionsData = [
    {
        question: "question one id 1",
        type: qtype.multipleChoice,
        ctestId: 7,
        option1: 'Option 1A',
        option2: 'Option 1B',
        option3: 'Option 1C',
        option4: 'Option 1D',
        correctResponse: 1
    },
    {
        question: "question one id 2",
        ctestId: 7,
        type: qtype.trueFalse,
        option1: 'True',
        option2: 'False',
        correctResponse: 1
    },
    {
        question: "question one id 3",
        type: qtype.multipleChoice,
        ctestId: 7,
        option1: 'Option 3A',
        option2: 'Option 3B',
        option3: 'Option 3C',
        option4: 'Option 3D',
        correctResponse: 2
    }
];

export const cTestResponseData = [
    {
        ctestSubmissionId: 1,
        ctestQuestionsId: 1,
        ctestId: 1,
        endUsersId: 1,
        response: 1
    },
    {
        ctestQuestionsId: 2,
        ctestSubmissionId: 2,
        ctestId: 2,
        endUsersId: 1,
        response: 0
    },
    {
        ctestQuestionsId: 3,
        ctestSubmissionId: 1,
        ctestId: 2,
        endUsersId: 1,
        response: 2
    }
];

export const subjectRecordsData = [
    {
        subjectId: 1,
        mentorId: 1,
        doubtId: null,
        comment: "This is a comment for subject 1 with mentor 1"
    },
    {
        subjectId: 2,
        mentorId: null,
        doubtId: 1,
        comment: "This is a comment for subject 2 with doubt 1"
    },
    {
        subjectId: 1,
        mentorId: null,
        doubtId: 2,
        comment: "This is a comment for subject 1 with doubt 2"
    },
    {
        subjectId: 2,
        mentorId: 2,
        doubtId: null,
        comment: "This is a comment for subject 2 with mentor 2"
    },
    {
        subjectId: 1,
        mentorId: 2,
        doubtId: null,
        comment: "This is a comment for subject 1 with mentor 2"
    },
    {
        subjectId: 2,
        mentorId: 1,
        doubtId: null,
        comment: "This is a comment for subject 2 with mentor 1"
    },
    {
        subjectId: 1,
        mentorId: null,
        doubtId: 1,
        comment: "This is a comment for subject 1 with doubt 1"
    },
    {
        subjectId: 2,
        mentorId: null,
        doubtId: 2,
        comment: "This is a comment for subject 2 with doubt 2"
    }
];

export const ctestSubmissionData = [
    {
        endUsersId: 1,
        ctestId: 1
    },
    {
        endUsersId: 2,
        ctestId: 2
    }
]

export const DiscountsData = [
    {
        title: "Summer Discount",
        type: 1,
        minPurchase: 50.00,
        maxValue: 20.00,
        bigCourseId: 1,
        validity: new Date("2024-08-31"),
        isActive: true
    },
    {
        title: "New User Bonus",
        type: 0,
        bigCourseId: 2,
        minPurchase: 0,
        maxValue: 10.00,
        validity: new Date("2024-12-31"),
        isActive: true
    },
    {
        title: "Holiday Special",
        type: 1,
        bigCourseId: 1,
        minPurchase: 100.00,
        maxValue: 30.00,
        validity: new Date("2024-12-25"),
        isActive: false
    }
];