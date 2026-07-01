const Student = require('../models/Student');
const Course = require('../models/Course');
const { errorResponse } = require('../utils/responses');
const CryptoJS = require('crypto-js');

exports.registerStudent = async (req, res) => {
    try {
        const { studentId, name, courseName } = req.body;
        
        if (!studentId || !name || !courseName) {
            return errorResponse(res, 400, 'All fields (studentId, name, courseName) are required');
        }

        const course = await Course.findOne({ name: courseName });
        if (!course) {
            return errorResponse(res, 404, 'Course not found');
        }
        
        const existingStudent = await Student.findOne({ student_id: studentId });
        if (existingStudent) {
            return errorResponse(res, 409, 'Student already registered');
        }
        
        const student = new Student({
            student_id: studentId,
            name,
            course_id: course._id
        });
        
        await student.save();
        res.json({ 
            success: true, 
            message: 'Student registered successfully',
            studentId: student.student_id
        });
    } catch (error) {
        if (error.name === 'ValidationError') {
            return errorResponse(res, 400, 'Validation error', error.errors);
        }
        console.error('Registration error:', error);
        errorResponse(res, 500, 'Internal server error');
    }
};

exports.generateQR = async (req, res) => {
    try {
        const { studentId, courseName } = req.body;
        
        if (!studentId || !courseName) {
            return errorResponse(res, 400, 'Both studentId and courseName are required');
        }

        const student = await Student.findOne({ student_id: studentId })
            .populate('course_id');
            
        if (!student) {
            return errorResponse(res, 404, 'Student not found');
        }
        
        if (student.course_id.name !== courseName) {
            return errorResponse(res, 403, 'Faculty/Employee does not belong to this Cluster');
        }
        
        const studentData = {
            student_id: student.student_id,
            name: student.name,
            course: courseName,
            timestamp: new Date().toISOString()
        };
        
        const encrypted = CryptoJS.AES.encrypt(
            JSON.stringify(studentData),
            student.course_id.encryption_key
        ).toString();
        
        res.json({
            success: true,
            encryptedData: encrypted,
            name: student.name
        });
    } catch (error) {
        console.error('QR generation error:', error);
        errorResponse(res, 500, 'Internal server error');
    }
};