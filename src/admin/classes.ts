export class MentorUpdate {
    id: number;
    name?: string;
    email?: string;
    address?: string;
    phone?: string;
    dob?: string;
    searchTags?: string;
    languages?: string;
    qualifications?: any[];
    Grades?: string[];
    subjectRecords?: any[];

    constructor(data: any) {
        this.id = data.id;
        this.name = data.name;
        this.email = data.email;
        this.address = data.address;
        this.phone = data.phone;
        this.dob = data.dob;
        this.searchTags = data.searchTags;
        this.languages = data.languages;
        this.qualifications = data.qualifications;
        this.Grades = data.Grades;
        this.subjectRecords = data.subjectRecords;
    }

    validate(): string | null {
        if (!this.id) {
            return 'Mentor ID is required';
        }

        if (this.name && typeof this.name !== 'string') {
            return 'Invalid type for name, expected string.';
        }

        if (this.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email)) {
            return 'Invalid email format';
        }

        if (this.phone && !/^\d+$/.test(this.phone)) {
            return 'Invalid phone number format';
        }

        if (this.dob) {
            const parsedDob = new Date(this.dob);
            if (isNaN(parsedDob.getTime())) {
                return 'Invalid date of birth format';
            }
        }

        if (this.searchTags && typeof this.searchTags !== 'string') {
            return 'searchTags must be a string';
        }

        if (this.languages && typeof this.languages !== 'string') {
            return 'languages must be a string';
        }

        if (this.Grades && !Array.isArray(this.Grades)) {
            return 'Grades must be an array';
        }

        if (this.qualifications && !Array.isArray(this.qualifications)) {
            return 'qualifications must be an array';
        }

        if (this.subjectRecords && !Array.isArray(this.subjectRecords)) {
            return 'subjectRecords must be an array';
        }

        return null;
    }

    parseDob(): Date | null {
        if (this.dob) {
            const parsedDob = new Date(this.dob);
            if (!isNaN(parsedDob.getTime())) {
                return parsedDob;
            }
        }
        return null;
    }
}

export class BigCourseUpdate {
    id: number;
    name?: string;
    searchTags?: string[];
    prerequisites?: string[];
    syllabus?: string[];
    category?: string;
    description?: string;
    level?: string;
    price?: number;
    currentPrice?: number;
    isLongTerm?: boolean;
    startDate?: string;
    endDate?: string;
    averageRating?: number;
    duration?: number;
    thumbnailUrl?: string;
    language?: string;
    grade?: string;
    mentorList?: number[];
    subjectList?: number[];

    constructor(data: any) {
        this.id = data.id;
        this.name = data.name;
        this.searchTags = data.searchTags;
        this.prerequisites = data.prerequisites;
        this.syllabus = data.syllabus;
        this.category = data.category;
        this.description = data.description;
        this.level = data.level;
        this.price = data.price;
        this.currentPrice = data.currentPrice;
        this.isLongTerm = data.isLongTerm;
        this.startDate = data.startDate;
        this.endDate = data.endDate;
        this.averageRating = data.averageRating;
        this.duration = data.duration;
        this.thumbnailUrl = data.thumbnailUrl;
        this.language = data.language;
        this.grade = data.grade;
        this.mentorList = data.mentorList;
        this.subjectList = data.subjectList;
    }

    validate(): string | null {
        if (!this.id) {
            return 'Course ID is required';
        }

        if ((this.price !== undefined && typeof this.price !== 'number') ||
            (this.currentPrice !== undefined && typeof this.currentPrice !== 'number') ||
            (this.averageRating !== undefined && typeof this.averageRating !== 'number')) {
            return 'Invalid numeric field';
        }

        if ((this.searchTags && !Array.isArray(this.searchTags)) ||
            (this.prerequisites && !Array.isArray(this.prerequisites)) ||
            (this.syllabus && !Array.isArray(this.syllabus)) ||
            (this.mentorList && !Array.isArray(this.mentorList)) ||
            (this.subjectList && !Array.isArray(this.subjectList))) {
            return 'Invalid array field';
        }

        return null;
    }

    parseDates(): { parsedStartDate?: Date, parsedEndDate?: Date, error?: string } {
        const result: { parsedStartDate?: Date, parsedEndDate?: Date, error?: string } = {};

        if (this.startDate !== undefined) {
            const parsedStartDate = new Date(this.startDate);
            if (isNaN(parsedStartDate.getTime())) {
                result.error = 'Invalid start date format';
            } else {
                result.parsedStartDate = parsedStartDate;
            }
        }

        if (this.endDate !== undefined) {
            const parsedEndDate = new Date(this.endDate);
            if (isNaN(parsedEndDate.getTime())) {
                result.error = 'Invalid end date format';
            } else {
                result.parsedEndDate = parsedEndDate;
            }
        }

        return result;
    }
}

