const Course = require('../models/Course');
const Student = require('../models/Student');
const { errorResponse } = require('../utils/responses');

exports.createCourse = async (req, res) => {
    try {
        const { name, encryptionKey } = req.body;
        
        if (!name || !encryptionKey) {
            return errorResponse(res, 400, 'Both name and encryptionKey are required');
        }

        if (encryptionKey.length < 16) {
            return errorResponse(res, 400, 'Encryption key must be at least 16 characters');
        }

        const existingCourse = await Course.findOne({ name });
        if (existingCourse) {
            return errorResponse(res, 409, 'Course already exists');
        }

        const newCourse = new Course({ name, encryption_key: encryptionKey });
        await newCourse.save();
        
        res.json({
            success: true,
            message: 'Course created successfully',
            course: {
                name: newCourse.name,
                createdAt: newCourse.created_at
            }
        });
    } catch (error) {
        if (error.name === 'ValidationError') {
            return errorResponse(res, 400, 'Validation error', error.errors);
        }
        console.error('Course creation error:', error);
        errorResponse(res, 500, 'Internal server error');
    }
};

exports.bulkCreateCourses = async (req, res) => {
    try {
        const { courses } = req.body;
        
        if (!courses || !Array.isArray(courses)) {
            return errorResponse(res, 400, 'Request body must contain a "courses" array');
        }

        const results = await Promise.all(courses.map(async (course, index) => {
            try {
                if (!course.name || !course.encryptionKey) {
                    throw new Error('Each course must have name and encryptionKey');
                }

                if (course.encryptionKey.length < 16) {
                    throw new Error('Encryption key must be at least 16 characters');
                }

                const existingCourse = await Course.findOne({ name: course.name });
                if (existingCourse) {
                    return { 
                        name: course.name,
                        status: 'exists',
                        message: 'Course already exists'
                    };
                }

                const newCourse = new Course({
                    name: course.name,
                    encryption_key: course.encryptionKey
                });

                await newCourse.save();
                return {
                    name: course.name,
                    status: 'created',
                    message: 'Course created successfully'
                };
            } catch (error) {
                return {
                    name: course?.name || `Course at index ${index}`,
                    status: 'failed',
                    message: error.message
                };
            }
        }));

        res.json({
            success: true,
            results
        });
    } catch (error) {
        console.error('Bulk course upload error:', error);
        errorResponse(res, 500, 'Failed to process bulk course upload', error.message);
    }
};

const DEPARTMENT_ORDER = [
    "Office of the University President (UP)",
    "Center for Holistic Advancement of Religious Instruction, Spirituality, and Ministry (CHARISM)",
    "Marketing, Alumni Relations, Internationalization, and Engagement Office (MARIAE)",
    "Quality Assurance, Monitoring, Planning, and Improvement Office (QAMPI)",
    "Office of the Vice President for Administration (VPA)",
    "Faculties, Auxiliary Services, and Transportation Office (FAST)",
    "Human Resource Development Office (HRDO)",
    "Medical and Dental Clinic (M/D)",
    "Office of the Management Information Systems and Services (OMISS)",
    "Office of the Vice President for Finance (VPF)",
    "Accounting and Financial Management Services (AMFS)",
    "Treasury and Resource Management Services (TRMS)",
    "Office of the Vice President for Academic Affairs (VPAA)",
    "GinhawUA Center and Admissions Office (GCAO)",
    "Office of the Student Affairs (OSA)",
    "Office of the University Registrar (OUR)",
    "University Libraries and Archives",
    "Research Ethics Board Office (REB)",
    "Research and Extension Office (REO)",
    "SED - Grade School",
    "SED - Junior High School",
    "SED - Senior High School",
    "SED - Physical Education Department",
    "SED - Theology Department",
    "SHAS - College of Nursing and Pharmacy",
    "SHAS - School of Arts and Sciences",
    "SOB - College of Accountancy",
    "SOB - College of Hospitality and Tourism Management",
    "SOB - School of Business and Public Management",
    "STS - College of Engineering and Architecture",
    "STS - College of Information Technology"
];

const sortCourses = (coursesList) => {
    return coursesList.sort((a, b) => {
        const indexA = DEPARTMENT_ORDER.indexOf(a.name);
        const indexB = DEPARTMENT_ORDER.indexOf(b.name);
        
        if (indexA === -1 && indexB === -1) return a.name.localeCompare(b.name);
        if (indexA === -1) return 1;
        if (indexB === -1) return -1;
        
        return indexA - indexB;
    });
};

exports.getAllCourses = async (req, res) => {
    try {
        const courses = await Course.find({}, 'name');
        const sortedCourses = sortCourses(courses);
        res.json({
            success: true,
            courses: sortedCourses
        });
    } catch (error) {
        console.error('Get courses error:', error);
        errorResponse(res, 500, 'Failed to fetch courses');
    }
};

exports.getFullCourses = async (req, res) => {
    try {
        const courses = await Course.find({}, 'name encryption_key created_at');
        const formatted = courses.map(c => ({
            id: c._id,
            name: c.name,
            encryptionKey: c.encryption_key,
            createdAt: c.created_at
        }));
        const sortedCourses = sortCourses(formatted);
        res.json({
            success: true,
            courses: sortedCourses
        });
    } catch (error) {
        console.error('Get full courses error:', error);
        errorResponse(res, 500, 'Failed to fetch courses');
    }
};

exports.updateCourse = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, encryptionKey } = req.body;
        
        if (!name && !encryptionKey) {
            return errorResponse(res, 400, 'Either name or encryptionKey must be provided');
        }

        if (encryptionKey && encryptionKey.length < 16) {
            return errorResponse(res, 400, 'Encryption key must be at least 16 characters');
        }

        const course = await Course.findById(id);
        if (!course) {
            return errorResponse(res, 404, 'Course not found');
        }

        if (name && name !== course.name) {
            const existingCourse = await Course.findOne({ name });
            if (existingCourse) {
                return errorResponse(res, 409, 'Course with this name already exists');
            }
            course.name = name;
        }

        if (encryptionKey) {
            course.encryption_key = encryptionKey;
        }

        await course.save();
        
        res.json({
            success: true,
            message: 'Course updated successfully',
            course: {
                id: course._id,
                name: course.name,
                encryptionKey: course.encryption_key,
                createdAt: course.created_at
            }
        });
    } catch (error) {
        if (error.name === 'ValidationError') {
            return errorResponse(res, 400, 'Validation error', error.errors);
        }
        console.error('Course update error:', error);
        errorResponse(res, 500, 'Internal server error');
    }
};

exports.deleteCourse = async (req, res) => {
    try {
        const { id } = req.params;

        const studentCount = await Student.countDocuments({ course_id: id });
        if (studentCount > 0) {
            return errorResponse(res, 400, 'Cannot delete course with registered students');
        }

        const result = await Course.findByIdAndDelete(id);
        if (!result) {
            return errorResponse(res, 404, 'Course not found');
        }
        
        res.json({
            success: true,
            message: 'Course deleted successfully'
        });
    } catch (error) {
        console.error('Course deletion error:', error);
        errorResponse(res, 500, 'Internal server error');
    }
};