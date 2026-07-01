const Attendance = require('../models/Attendance');
const Student = require('../models/Student');
const Course = require('../models/Course');
const CryptoJS = require('crypto-js');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const { errorResponse } = require('../utils/responses');

/**
 * VERIFY QR CODE & RECORD ATTENDANCE
 * Handles both Time-In and Time-Out logic
 */
exports.verifyQR = async (req, res) => {
    try {
        const { encryptedData, courseName } = req.body;
        
        if (!encryptedData || !courseName) {
            return errorResponse(res, 400, 'All fields (encryptedData, courseName) are required');
        }

        const course = await Course.findOne({ name: courseName });
        if (!course) {
            return errorResponse(res, 404, 'Course not found');
        }

        let decryptedString;
        try {
            const bytes = CryptoJS.AES.decrypt(encryptedData, course.encryption_key);
            decryptedString = bytes.toString(CryptoJS.enc.Utf8);
            
            if (!decryptedString) {
                return errorResponse(res, 401, 'Invalid QR code - decryption failed');
            }
        } catch (decryptError) {
            return errorResponse(res, 401, 'Invalid QR code format');
        }

        let decryptedData;
        try {
            decryptedData = JSON.parse(decryptedString);
        } catch (parseError) {
            return errorResponse(res, 400, 'Invalid QR code format - could not parse decrypted data');
        }

        if (!decryptedData.student_id || !decryptedData.name || !decryptedData.course) {
            return errorResponse(res, 400, 'Invalid QR code format - missing required fields');
        }

        const student = await Student.findOne({ student_id: decryptedData.student_id })
            .populate('course_id', 'name');
            
        if (!student) {
            return errorResponse(res, 404, 'Student not found in database');
        }

        if (student.course_id.name !== courseName) {
            return errorResponse(res, 403, 'Faculty/Employee does not belong to this Cluster');
        }

        const latestAttendance = await Attendance.findOne({
            student_id: student._id,
            time_out: { $exists: false }
        }).sort({ time_in: -1 });
        
        if (latestAttendance) {
            latestAttendance.time_out = new Date();
            await latestAttendance.save();
            
            return res.json({
                success: true,
                action: 'time_out',
                message: 'Time out recorded successfully',
                student: {
                    studentId: student.student_id,
                    name: student.name,
                    course: student.course_id.name
                },
                time_in: latestAttendance.time_in,
                time_out: latestAttendance.time_out
            });
        }
        
        const newAttendance = new Attendance({
            student_id: student._id,
            time_in: new Date(),
            date_in: new Date()
        });
        
        await newAttendance.save();
        res.json({
            success: true,
            action: 'time_in',
            message: 'Time in recorded successfully',
            student: {
                studentId: student.student_id,
                name: student.name,
                course: student.course_id.name
            },
            time_in: newAttendance.time_in
        });
        
    } catch (error) {
        console.error('Verification error:', error);
        errorResponse(res, 500, 'Internal server error during verification');
    }
};

/**
 * DECRYPT QR CODE (Preview Only)
 */
exports.decryptQR = async (req, res) => {
    try {
        const { encryptedData, courseName } = req.body;
        
        if (!encryptedData || !courseName) {
            return errorResponse(res, 400, 'All fields (encryptedData, courseName) are required');
        }

        const course = await Course.findOne({ name: courseName });
        if (!course) {
            return errorResponse(res, 404, 'Course not found');
        }

        let decryptedString;
        try {
            const bytes = CryptoJS.AES.decrypt(encryptedData, course.encryption_key);
            decryptedString = bytes.toString(CryptoJS.enc.Utf8);
            
            if (!decryptedString) {
                return errorResponse(res, 401, 'Invalid QR code - decryption failed');
            }
        } catch (decryptError) {
            return errorResponse(res, 401, 'Invalid QR code format');
        }

        let decryptedData;
        try {
            decryptedData = JSON.parse(decryptedString);
        } catch (parseError) {
            return errorResponse(res, 400, 'Invalid QR code format - could not parse decrypted data');
        }

        res.json({
            success: true,
            student: {
                studentId: decryptedData.student_id,
                name: decryptedData.name,
                course: decryptedData.course
            }
        });
        
    } catch (error) {
        console.error('Decryption error:', error);
        errorResponse(res, 500, 'Internal server error during decryption');
    }
};

/**
 * GET ALL ATTENDANCE RECORDS (With Filters)
 */
exports.getAttendances = async (req, res) => {
    try {
        const { date, course } = req.query;
        
        let query = {};
        if (date) {
            const startDate = new Date(date);
            startDate.setHours(0, 0, 0, 0);
            const endDate = new Date(date);
            endDate.setHours(23, 59, 59, 999);
            query.date_in = { $gte: startDate, $lte: endDate };
        }
        
        if (course) {
            const courseObj = await Course.findOne({ name: course });
            if (courseObj) {
                const students = await Student.find({ course_id: courseObj._id });
                query.student_id = { $in: students.map(s => s._id) };
            }
        }
        
        const attendances = await Attendance.find(query)
            .populate({
                path: 'student_id',
                select: 'student_id name course_id',
                populate: {
                    path: 'course_id',
                    select: 'name'
                }
            })
            .sort({ date_in: -1, time_in: -1 });
        
        const resolvedAttendances = attendances.map(a => {
            if (!a.student_id) return null;
            return {
                studentId: a.student_id.student_id,
                studentName: a.student_id.name,
                course: a.student_id.course_id?.name || 'Unknown Course',
                timeIn: a.time_in,
                timeOut: a.time_out,
                date: a.date_in
            };
        }).filter(a => a !== null);
        
        res.json({ success: true, attendances: resolvedAttendances });
    } catch (error) {
        console.error('Get attendances error:', error);
        errorResponse(res, 500, 'Failed to fetch attendances');
    }
};

/**
 * CLEAR ATTENDANCE RECORDS
 */
exports.clearAttendances = async (req, res) => {
    try {
        const { date, course } = req.body;
        let query = {};
        if (date) {
            const startDate = new Date(date);
            startDate.setHours(0, 0, 0, 0);
            const endDate = new Date(date);
            endDate.setHours(23, 59, 59, 999);
            query.date_in = { $gte: startDate, $lte: endDate };
        }
        if (course) {
            const courseObj = await Course.findOne({ name: course });
            if (courseObj) {
                const students = await Student.find({ course_id: courseObj._id });
                query.student_id = { $in: students.map(s => s._id) };
            }
        }
        const result = await Attendance.deleteMany(query);
        res.json({ success: true, message: `Deleted ${result.deletedCount} records`, deletedCount: result.deletedCount });
    } catch (error) {
        errorResponse(res, 500, 'Failed to clear attendance records');
    }
};

/**
 * GENERATE ATTENDANCE PDF
 * Custom Styling: CREARE ET INNOVARE 2026
 */
exports.generateAttendancePDF = async (req, res) => {
    try {
        const { date, course } = req.query;
        let query = {};
        if (date) {
            const startDate = new Date(date);
            startDate.setHours(0, 0, 0, 0);
            const endDate = new Date(date);
            endDate.setHours(23, 59, 59, 999);
            query.date_in = { $gte: startDate, $lte: endDate };
        }
        if (course) {
            const courseObj = await Course.findOne({ name: course });
            if (courseObj) {
                const students = await Student.find({ course_id: courseObj._id });
                query.student_id = { $in: students.map(s => s._id) };
            }
        }
        
        const attendances = await Attendance.find(query)
            .populate({
                path: 'student_id',
                select: 'student_id name course_id',
                populate: { path: 'course_id', select: 'name' }
            })
            .sort({ date_in: -1, time_in: -1 });

        if (attendances.length === 0) {
            return res.status(404).json({ error: 'No attendance records found for the selected filters' });
        }

        const doc = new PDFDocument({ margin: 30, size: 'A4', layout: 'landscape', bufferPages: true });
        res.setHeader('Content-Type', 'application/pdf');
        
        const reportDate = date ? date.replace(/-/g, '') : new Date().toISOString().slice(0, 10).replace(/-/g, '');
        let filename = `ATTENDANCE_RECORDS_UATB2026_${reportDate}`;
        if (course) filename += `_${course.replace(/\s+/g, '_')}`;
        res.setHeader('Content-Disposition', `attachment; filename="${filename}.pdf"`);
        
        doc.pipe(res);
        
        // --- HEADER STYLING ---
        doc.fillColor('#072758') // Deep Blue
           .fontSize(20)
           .font('Helvetica-Bold')
           .text('UA TEAM BUILDING 2026', { align: 'center' });
           
        doc.fontSize(14)
           .text('Attendance Records', { align: 'center' });
        
        doc.moveDown(1);

        // Filter Box
        doc.rect(30, doc.y, doc.page.width - 60, 60).fill('#EBEBEB').stroke('#072758');
        doc.fillColor('#072758').fontSize(12).font('Helvetica-Bold').text('Report Filters:', 40, doc.y + 15);
        doc.font('Helvetica').fillColor('#333333');
        
        let filterY = doc.y + 15;
        if (date) { doc.text(`• Date: ${date}`, 50, filterY); filterY += 15; }
        if (course) { doc.text(`• Course: ${course}`, 50, filterY); filterY += 15; }
        doc.text(`• Generated: ${new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}`, 50, filterY);
        doc.moveDown(3);
        
        // Table Config
        const headers = ['Student ID', 'Name', 'Course', 'Time In', 'Time Out', 'Date', 'Status'];
        const columnWidths = [90, 120, 220, 80, 80, 90, 70];
        const rowHeight = 25;
        let y = doc.y;
        
        // Render Headers
        let x = 30;
        headers.forEach((header, i) => {
            doc.rect(x, y, columnWidths[i], rowHeight).fill('#072758').stroke('#072758');
            doc.fillColor('#ffffff').fontSize(9).font('Helvetica-Bold').text(header, x + 5, y + 8, { width: columnWidths[i] - 10 });
            x += columnWidths[i];
        });
        
        y += rowHeight;

        // Render Rows
        attendances.forEach((att, index) => {
            if (!att.student_id) return;
            
            // Page Break Logic
            if (y + rowHeight > doc.page.height - 50) {
                doc.addPage({ size: 'A4', layout: 'landscape', margin: 30 });
                y = 30;
                x = 30;
                headers.forEach((header, i) => {
                    doc.rect(x, y, columnWidths[i], rowHeight).fill('#072758').stroke('#072758');
                    doc.fillColor('#ffffff').text(header, x + 5, y + 8);
                    x += columnWidths[i];
                });
                y += rowHeight;
            }

            const rowColor = index % 2 === 0 ? '#ffffff' : '#f0f4f8';
            const courseName = att.student_id.course_id?.name || 'Unknown';
            const timeOut = att.time_out ? new Date(att.time_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Manila' }) : 'N/A';
            const status = att.time_out ? 'Signed Out' : 'Present';
            
            const rowData = [
                att.student_id.student_id,
                att.student_id.name,
                courseName,
                new Date(att.time_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Manila' }),
                timeOut,
                new Date(att.date_in).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila' }),
                status
            ];

            x = 30;
            rowData.forEach((cell, i) => {
                doc.rect(x, y, columnWidths[i], rowHeight).fill(rowColor).stroke('#eeeeee');
                doc.fillColor('#333333').font('Helvetica').fontSize(9).text(cell, x + 5, y + 8, { width: columnWidths[i] - 10, ellipsis: true });
                x += columnWidths[i];
            });
            y += rowHeight;
        });

        doc.end();
    } catch (error) {
        console.error('PDF error:', error);
        if (!res.headersSent) res.status(500).json({ error: 'Failed to generate PDF' });
    }
};