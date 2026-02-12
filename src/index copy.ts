// import express from 'express';
// import path from 'path';
// import http from 'http';
// import { Request, Response } from "express";
// import { Server as SocketIOServer, Socket } from 'socket.io';
// import * as jwt from 'jsonwebtoken';

// import { createUser, generateAndSendOtpUser, MentorLogin, verifyOtpLoginUser, updateUser, CompleteUserRegisteration, createUserAdmin, updateUserAdmin, updateUserDeviceId, GetUserById, getMyPurchases2, SoftDeleteUser, findUser } from './UserFuncs';
// import { authenticateTokenUser, downlinkMessage, getRedisContents, prisma, SECRET, sendMsgx, uploadImage } from './misc';
// import { GetMentorBySubject, GetMentorData, GetMentorsByClasses, GetMyMentors, InsertMentor, updateMentor, updateMentorPassword, updateMentorPassword2 } from './mentor';
// import { GetCoursesByGrade, GetTeacherCourses, InsertCourse, UpdateCourse } from './courses';
// import { GetUsersByBigCourse, InsertLessons, UpdateLessons } from './lessons';
// import { GetTeacherAssignments, GetUserAssingments, InsertAssignmentWithFiles, InsertSubmission, UpdateAssignment, GetMySubmissions, InsertSubmissionWithFiles } from './assignments';
// import { logMessageServer } from "./consts";
// import { adminLogin, adminLoginUpdate, GetStudent } from './adminFuncs';
// import { getChatHistoryParticipants, GetConversationn, GetMessages, getMessagesByUUID, GetMyUUID, insertMessage, MarkMessageIDsRead } from './messageStore';
// import { CreatePurchase, GetMyPurchases } from './purchases';
// import { AssignMentor, GetAllDoubts, getAssignedDoubts, getAssignedDoubtsList, getDoubtFiles, getMyDoubts, insertDoubt, insertDoubtResponse, updateDoubt, updateDoubtResponse } from './doubts';
// import { UploadAssignments, UploadCourseMaterials } from "./uploads"
// import { DeleteCourse, DeleteSchedules, GetLtCourseCatalog, GetLtCourseCatalogBySubject, InsertLtCourse, InsertSchedule } from './ltCourse';
// import { GetOfferByCourse, InsertOffer } from './offers';
// import { getChatInfo as getChatPaticipantInfo } from './getUserInfoByUUID';
// import { GetMySubscription, InsertSubciption } from './subscriptions';
// import { GetAllBoards, GetAllSubjectData, GetSubjectByGrade, GetSubjectById, InsertBoard, InsertSubject, UpdateBoard, updateSubject } from './subjects';
// import { GetUserAssignments2 } from './getMyAssignments2';
// import { InsertAndCheckMcqResponses } from './mcqResponse';
// import { GetTestByCourseId } from './mcqTests';
// import { GetBigCourses, GetBigCourses2, GetBigCourses3, GetBigCoursesById, GetLongTermCoursesPublicList, getMaterialFilesList, getMaterialFilesListwithTime } from './bigCourseFuncs/mainCourse';
// import { getCourseTestResponses, getMyBgCourseSubscriptions, GetSessionTestSubmissions, SubmitCourseTestResponse } from './bigCourseFuncs/sessionTestResponse';
// import { GetMentor, GetMentorCourses, GetMentorRatings, InsertMentorRating } from './mentor2';
// import { deleteSession, EditSession, GetSessionsByBigCourse, getStreamInfo, InsertNewSession, InsertNewSessionStream } from './sessions';
// import { GetMultipleStudentInfo, GetMyBigCourseStudents, getStudentByGrade } from './getMyStudents';
// import { getStudentAttendanceRecords, getStudentListBySession, insertAttendanceRecord, RecordAttendanceExitTime } from './attendanceRecords';
// import { InsertSessionTestQuestions, InsertSessionTests } from './sessionTests';
// import { createSessionTestSubmission, GetMyBigCourseSessionTestSubmissions, GetMyBigCourseSessionTestSubmissionsByDate, GetMySessionTestSubmission, getStudentListSessionTestSubmission } from './sessionTestSubmission';
// import { GetMyAttendanceProgressReport, sessionAttendanceList } from './studentProgressReport';
// import { AddMentor, createBigCourse, updateBigCourse } from './admin/adds';
// import { GetAllCourses, GetAllMentors, GetPagedStudentList } from './admin/gets.';
// import { createCtest, createCtestSubmission, deleteCTest, editCtest, GetAllCtestSubmissionsByCourse, GetCtests, GetMyBigCourseCtestSubmission, GetMyCtestSubmission } from './ctest';
// import { createMgSubscription, getMgSubscriptions, getMgSubscriptionsByStudent, getMgSubscriptionsByUserId, markMgSubscriptionAsFullyPaid, MgSubtoggleIsActive, updateMgSubscriptionDueDate } from './purchaseMgSub';
// import { GetCombinedStats } from './getCombinedStats';
// import { cancelScheduledNotifs, getScheduledNotifs, GetUserNotifications, InterceptAndPass, PassMultiNotifcation, updateScheduledNotifs } from './notifs';
// import { getFreeBannerList, InsertBanner, InsertFreeBanner, removeBanner } from './banners';
// import { DeleteLead, InsertLead, InsertSalesman, ListAllLeads, ListSalesmen, LoginSalesMan, MyLeads, UpdateSalesman } from './leads';
// import { AdminReport } from './report';
// import { leadsRouter, UpdateLead2 } from "./leadManager/main"
// import { AddRoomIdtoPtm, endPtm, GetStudentPtms, InsertPtm, startPtm } from './ptm';
// import { ApproveLeaveReq, CreateDefaultHolidays, createHr, CreateLeaveReq, DenyLeaveReq, getAllAttendanceRecords, getAllHolidays, getAllPendingLeaves, getLeavesByMentorId, GetMyLeaves, hrLogin, markLogin, markLogout, getAllAttendanceRecordsByMentor, getDateRangeRecords, getSalesmanById } from './hrmFuncs'
// import { createOrder } from './razorpay';
// import { createInq, getInq } from './inq';
// import { markLoginSales, markLogoutSales, CreateLeaveReqSales, GetMyLeavesSales, DenyLeaveReqSales, ApproveLeaveReqSales, getAllPendingLeavesSales, getLeavesBySalesManId, getAllAttendanceRecordsSales, getAllAttendanceRecordsBySalesMan, getDateRangeRecordsSales } from './hrmFuncsSales'
// import { createAsset, getAllAssets, getAsset, updateAsset } from './assetManagement';
// import { createAssetRecord, getAssetRecord, updateAssetRecord, getAllAssetRecords, getRecordsByAssetId, getRecordsByCondition, getRecordsWithAssetDetails } from './assetRecords';
// import { callToken } from './call';
// import { CreateGroup, GetMyGroups, UpdateGroup } from './groupChatFuncs';
// import { updateTextFile } from './updateStaticText';
// import { createRegFormLeads, GetAllRegFormLeads, GetNewRegFormLeads, UpdateRegFormLeads } from './RegLeads';
// import { getCourseBannerList, InsertCourseBanners, removeCourseBanner } from './courseBanners';
// import { __assign } from 'tslib';
// import { createApnProvider, createInitiateCallHandler, ApnConfig, GetUserVoipToken, UpdateApnToken } from "./apn"
// import pythonApiProxy from './etech_proxy';
// import { createqtest, createqtestSubmission, GetAllqtestSubmissionsByCourse, GetMyBigCourseqtestSubmission, GetMyqtestSubmission, Getqtests } from './qtest';
// import { genUserToken } from './userGenToken';
// import { abortS3upload, completeS3upload, getS3uploadUrl, initS3upload } from './awsUploadRecording';
// import { getSignedUrlAws, updateRecordingUrl } from './recordings';
// import { addQuizWithQuestions, quizQuestionResponse } from './quiz';
// import { addGroupMemberEndpoint, createGroupEndpoint, deleteMessage, getAllGroupsAdmin, getGroupMessages, getMentorGroups, getNameByType, getReadReciept, getRecentMessagesGroup, getStudentGroups, markReadGroupMessage, sendGroupMessage, updateGroupType } from './courseGroupChat';
// import { addSessionAnalytics, getAllAnalyticsData, getCourseFeedback, getFeedbackStatus, postStudentDailyAnalytics, submitFeedback, testMail } from './sessionAnalytics';

// import testRoutes from './routes/test.route'

// import cors from "cors";

// // corn jobs //
// import './jobs/dailyAnalytics'
// import './jobs/scheduledNotifCron'
// import './jobs/courseRatingUpdate'
// import { createAiReview, getAllAiReview } from './aiReview';
// import upload from './middlewares/multer';
// import { AccessRequestReview, AdminAuditLogs, ApproverAssign, ContentPreview, ContentRequestAccess, ContentReview, ContentUpload } from './content';
// import { authAdmin, authAdminOrMentor, authAnyone, authMentor, authUser } from './middlewares/auth';
// import { createWorkers } from './mediasoup/createWorkers';
// import { classroomSocketHandler } from './sockets/classroom';

// interface CustomSocket extends Socket {
//   user?: any;
//   permaID?: number
//   role?: string
// }

// console.log(path.join(__dirname, "../", "AuthKey_76VCGV6BTH.p8"), "should be the filepath")
// // --- 1. Configure APNs ---
// const ProdApnConfig: ApnConfig = {
//   token: {
//     key: path.join(__dirname, "../", "AuthKey_76VCGV6BTH.p8") || process.exit(1), // Use non-null assertion or check existence
//     keyId: "76VCGV6BTH",
//     teamId: "FCJW2AQ5KH",
//   },
//   production: false,
//   topic: "com.sisya.sisyaclasses.voip", // e.g., com.yourcompany.yourapp.voip
// };

// let ProdApnProvider;

// try {
//   ProdApnProvider = createApnProvider(ProdApnConfig);
// } catch (e) {
//   console.error("FATAL: Could not create APN provider. Server cannot start.", e);
//   process.exit(1);
// }


// const TestApnConfig: ApnConfig = {
//   token: {
//     key: path.join(__dirname, "../", "AuthKey_76VCGV6BTH.p8") || process.exit(1), // Use non-null assertion or check existence
//     keyId: "76VCGV6BTH",
//     teamId: "FCJW2AQ5KH",
//   },
//   production: false,
//   topic: "com.sisya.sisyaclasses.voip", // e.g., com.yourcompany.yourapp.voip
// };

// let TestApnProvider;

// try {
//   TestApnProvider = createApnProvider(TestApnConfig);
// } catch (e) {
//   console.error("FATAL: Could not create APN provider. Server cannot start.", e);
//   process.exit(1);
// }

// // --- 3. Implement Your Actual Token Retrieval Logic ---
// const getRealUserVoipToken: GetUserVoipToken = async (userId: string): Promise<string | null> => {
//   const userToken = await (prisma.endUsers.findFirst({ where: { id: parseInt(userId) }, select: { apnToken: true } }))
//   const token = userToken?.apnToken
//   if (token) {
//     return token
//   } else {
//     return null
//   }
// };

// // --- 4. Create the Handler ---
// const ProdinitiateCallHandler = createInitiateCallHandler(
//   ProdApnProvider,
//   ProdApnConfig.topic,
//   getRealUserVoipToken // Inject your real function here
// );

// const TestInitiateCallHandler = createInitiateCallHandler(
//   TestApnProvider,
//   TestApnConfig.topic,
//   getRealUserVoipToken // Inject your real function here
// );

// const app = express();
// const server = http.createServer(app);

// app.use(
//   cors({
//     origin: "*"
//   })
// );

// export const io = new SocketIOServer(server, {
//   maxHttpBufferSize: 10e6, cors: {
//     origin: 'https://sisyaclass.xyz'
//   }
// },);
// const SocketToUserIdMap = new Map<number, string>()

// app.use(express.json({ limit: "220mb" }));
// app.use('/mg_mat', express.static(path.join(__dirname, '../mg_mat')));
// app.use('/assignments', express.static(path.join(__dirname, '../assignments')));
// app.use('/submissions', express.static(path.join(__dirname, '../submissions')));
// app.use('/admin', express.static(path.join(__dirname, '../admin')));
// app.use('/teacher', express.static(path.join(__dirname, '../teacher')));
// app.use('/thumbs', express.static(path.join(__dirname, '../thumbs')));
// app.use('/doubts', express.static(path.join(__dirname, '../doubts')));
// app.use('/test_route', testRoutes)

// app.post("/test", testMail);

// // TODO: add teacher auth tp this routes
// //teacher routes: 
// app.post("/teacher/login", MentorLogin)
// app.post("/teacher/insert_assignments", authMentor, InsertAssignmentWithFiles)
// app.patch("/teacher/insert_assignments", authMentor, UpdateAssignment)
// app.post("/teacher/insert_doubt_response", authMentor, insertDoubtResponse)
// app.patch("/teacher/update_doubt_response", authMentor, updateDoubtResponse)
// app.post("/teacher/upload_assignment", authMentor, UploadAssignments)
// app.post("/teacher/get_teacher_assignments", authMentor, GetTeacherAssignments)
// app.post("/teacher/add_course", authMentor, InsertCourse);
// app.post("/teacher/my_courses", authMentor, GetTeacherCourses)
// app.post("/teacher/add_lt_course", authMentor, InsertLtCourse)
// app.post("/teacher/add_schedule", authMentor, InsertSchedule)
// app.post("/teacher/login", MentorLogin);
// app.post("/teacher/get_all_courses", authMentor, GetMentorCourses)
// app.post("/teacher/add_session", authMentor, InsertNewSession)
// app.post("/teacher/del_session", authMentor, deleteSession)
// app.post("/teacher/get_big_course_sessions", authMentor, GetSessionsByBigCourse)
// app.post("/teacher/get_my_big_course_students", authMentor, GetMyBigCourseStudents)
// app.post("/teacher/get_multiple_student_info", authMentor, GetMultipleStudentInfo)
// app.post("/teacher/get_student_course_attendence_record", authMentor, getStudentAttendanceRecords)
// app.post("/teacher/get_session_attendance_student_list", authMentor, getStudentListBySession)
// app.post("/teacher/add_session_test", authMentor, InsertSessionTests)
// app.post("/teacher/update_mentor", authMentor, updateMentor)
// app.post("/teacher/add_session_test_question", authMentor, InsertSessionTestQuestions)
// app.post("/teacher/get_studentlist_session_test", authMentor, getStudentListSessionTestSubmission)
// app.post("/teacher/session_attendance_list", authMentor, sessionAttendanceList)
// app.post("/teacher/start_session", authMentor, InsertNewSessionStream)
// app.post("/teacher/get_ctests", authMentor, GetCtests)
// app.post("/teacher/get_qtests", authMentor, Getqtests)
// app.post("/teacher/get_assigned_doubts_users", authMentor, getAssignedDoubts)
// app.post("/teacher/sales/my_leads", MyLeads)//sales auth
// app.post("/teacher/sales/add_lead", InsertLead) //sales auth
// app.post("/teacher/sales/update_lead", UpdateLead2) //sales auth
// app.post("/teacher/sales/delete_lead", DeleteLead) //sales auth
// app.post("/teacher/sales/login", LoginSalesMan)
// app.post("/teacher/sales/new_leave_req", CreateLeaveReqSales) //sales auth
// app.post("/teacher/sales/my_leaves", GetMyLeavesSales) //sales auth
// app.post("/teacher/start_ptm", authMentor, startPtm)
// app.post("/teacher/end_ptm", authMentor, endPtm)
// app.post("/teacher/get_users_per_course", authMentor, GetUsersByBigCourse)
// app.post("/teacher/get_ctest_submissions_by_course", authMentor, GetAllCtestSubmissionsByCourse)
// app.post("/teacher/get_qtest_submissions_by_course", authMentor, GetAllqtestSubmissionsByCourse)
// app.post("/teacher/add_ptm_room_id", authMentor, AddRoomIdtoPtm)
// app.post("/teacher/get_assigned_doubts_list", authMentor, getAssignedDoubtsList)
// app.post("/teacher/update_doubt", authMentor, updateDoubt)
// app.post("/teacher/mark_login", authMentor, markLogin)
// app.post("/teacher/mark_logout", authMentor, markLogout)
// app.post("/teacher/requestLeave", authMentor, CreateLeaveReq)
// app.post("/teacher/get_my_leaves", authMentor, GetMyLeaves)
// app.post("/teacher/get_date_range_records", authMentor, getDateRangeRecords)
// app.post("/teacher/create_gc", authMentor, CreateGroup)
// app.post("/teacher/update_gc", authMentor, UpdateGroup)
// app.post("/teacher/get_student_by_grade", authMentor, getStudentByGrade)
// app.post("/teacher/update_password", authMentor, updateMentorPassword)
// app.post("/teacher/update_password2", authMentor, updateMentorPassword2)
// app.delete("/teacher/delete_course", authMentor, DeleteCourse)
// app.delete("/teacher/delete_schedule", authMentor, DeleteSchedules)
// app.post("/teacher/initiate-s3-upload", authMentor, initS3upload)
// app.post("/teacher/get-s3-part-upload-url", authMentor, getS3uploadUrl)
// app.post("/teacher/complete-s3-upload", authMentor, completeS3upload)
// app.post("/teacher/abort-s3-upload", authMentor, abortS3upload)
// app.post("/teacher/get-signed-url", authMentor, getSignedUrlAws)
// app.post("/teacher/update_recording", authMentor, updateRecordingUrl)
// app.post("/teacher/quiz_with_questions", authMentor, addQuizWithQuestions)
// app.post("/teacher/quiz_question_response", authMentor, quizQuestionResponse)
// app.get('/teacher/groups/:mentorId', authMentor, getMentorGroups)
// app.post('/teacher/add_session_analytics', authMentor, addSessionAnalytics);
// app.post("/teacher/get_bg_course_by_id", authMentor, GetBigCoursesById)
// app.post("/teacher/get_materials_with_time", authMentor, getMaterialFilesListwithTime)
// app.post("/teacher/upload_course_material", authMentor, UploadCourseMaterials)
// app.post("/teacher/insert_qtest", authMentor, createqtest)
// app.post("/teacher/get_conversation", authMentor, GetConversationn)
// app.post("/teacher/send_notif2", authMentor, InterceptAndPass)
// app.post("/teacher/get_token", authMentor, callToken)
// app.post("/teacher/send_call_ios", authMentor, ProdinitiateCallHandler)

// //content-management
// app.post('/teacher/content/upload', authMentor, upload.single("ppt"), ContentUpload);
// app.get("/teacher/content/:id/preview", authAdminOrMentor, ContentPreview);
// app.post("/teacher/content/:id/review", authMentor, ContentReview);
// app.post("/teacher/content/:id/request-access", authMentor, ContentRequestAccess);

// app.post("admin/access-requests/:id/review", authAdmin, AccessRequestReview);
// app.post("admin/approver-assign", authAdmin, ApproverAssign);
// app.get("/admin/audit", authAdmin, AdminAuditLogs);
// //TODO: add admin Auth here
// app.post("/admin/update", authAdmin, adminLoginUpdate);
// app.post('/admin/get_student_session_analytics', authAdmin, postStudentDailyAnalytics);
// app.post("/admin/get_recent_users", authAdmin, GetPagedStudentList);
// app.post("/admin/get_user_by_id", authAdmin, GetStudent);
// app.post("/admin/update_user", authAdmin, updateUser);
// app.post("/admin/create_big_course", authAdmin, createBigCourse)
// app.post("/admin/insert_mentor", authAdmin, AddMentor)
// app.post("/admin/add_session_test", authAdmin, InsertSessionTests)
// app.post("/admin/insert_ctest", authAdmin, createCtest)
// app.post("/admin/edit_ctest", authAdmin, editCtest)
// app.post("/admin/del_ctest", authAdmin, deleteCTest)
// app.post("/admin/insert_qtest", authAdmin, createqtest)
// app.post("/admin/add_board", authAdmin, InsertBoard)
// app.post("/admin/update_board", authAdmin, UpdateBoard)
// app.post("/admin/add_subject", authAdmin, InsertSubject)
// app.post("/admin/update_subject", authAdmin, updateSubject)
// app.post("/admin/create_student", authAdmin, createUserAdmin)
// app.post("/admin/update_student", authAdmin, updateUserAdmin)
// app.post("/admin/get_mentors", authAdmin, GetAllMentors)
// app.post("/admin/get_mentor_by_id", authAdmin, GetMentor)
// app.post("/admin/get_course", authAdmin, GetAllCourses)
// app.post("/admin/update_course", authAdmin, updateBigCourse)
// app.post("/admin/update_mentor", authAdmin, updateMentor)
// app.post("/admin/get_course_by_id", authAdmin, GetBigCoursesById)
// app.post("/admin/insert_banner", authAdmin, InsertBanner)
// app.post("/admin/add_session", authAdmin, InsertNewSession)
// app.post("/admin/get_all_courses", authAdmin, GetMentorCourses)
// app.post("/admin/get_all_leads", authAdmin, ListAllLeads)
// app.post("/admin/insert_salesman", authAdmin, InsertSalesman) // tested
// app.post("/admin/update_salesman", authAdmin, UpdateSalesman) // tested 
// app.post("/admin/get_purchases", authAdmin, getMgSubscriptions)
// app.post("/admin/get_purchases_by_student", authAdmin, getMgSubscriptionsByStudent)
// app.post("/admin/insert_free_banner", authAdmin, InsertFreeBanner)
// app.post("/admin/get_banner_list", authAdmin, getFreeBannerList)
// app.post("/admin/update_mentor_password", authAdmin, updateMentorPassword)
// app.post("/admin/remove_banner", authAdmin, removeBanner)
// app.post("/admin/get_mentor_courses", authAdmin, GetMentorCourses)
// app.post("/admin/get_report_user_course", authAdmin, AdminReport)
// app.post("/admin/insert_offer", authAdmin, InsertOffer)
// app.post("/admin/login", adminLogin)
// app.post("/admin/list_salesmen", authAdmin, ListSalesmen)
// app.post("/admin/send_notif", authAdmin, PassMultiNotifcation)
// app.post("/admin/add_ptm", authAdmin, InsertPtm)
// app.post("/admin/get_users_per_course", authAdmin, GetUsersByBigCourse)
// app.post("/admin/send_notif2", authAdmin, InterceptAndPass)
// app.post("/admin/get_scheduled_notifs", authAdmin, getScheduledNotifs)
// app.post("/admin/cancel_scheduled_notifs", authAdmin, cancelScheduledNotifs)
// app.post("/admin/update_scheduled_notifs", authAdmin, updateScheduledNotifs)
// app.post("/admin/all_doubts", authAdmin, GetAllDoubts)
// app.post("/admin/create_hr", authAdmin, createHr)
// app.post("/admin/get_inq", authAdmin, getInq)
// app.post("/admin/upload_course_material", authAdmin, UploadCourseMaterials)
// app.post("/admin/hr/login", hrLogin)
// app.post("/admin/upload_text", authAdmin, updateTextFile)
// app.post("/admin/insert_course_banner", authAdmin, InsertCourseBanners)
// app.post("/admin/mg_toggle_is_active", authAdmin, MgSubtoggleIsActive)
// app.post("/admin/mg_dueDate_change", authAdmin, updateMgSubscriptionDueDate)
// app.post("/admin/delete_course_banner", authAdmin, removeCourseBanner)
// app.post("/admin/hr/approve", ApproveLeaveReq)
// app.post("/admin/hr/approve_sales", ApproveLeaveReqSales)
// app.post("/admin/hr/deny", DenyLeaveReq)
// app.post("/admin/hr/deny_sales", DenyLeaveReqSales)
// app.post("/admin/hr/get_pending_leaves", getAllPendingLeaves)
// app.post("/admin/hr/get_pending_leaves_sales", getAllPendingLeavesSales)
// app.post("/admin/hr/get_leaves_by_mentor", getLeavesByMentorId)
// app.post("/admin/hr/get_leaves_by_salesman", getLeavesBySalesManId)
// app.post("/admin/hr/create_default_holiday", CreateDefaultHolidays)
// app.post("/admin/hr/get_all_holidays", getAllHolidays)
// app.post("/admin/hr/get_all_attendance_records", getAllAttendanceRecords)
// app.post("/admin/hr/get_all_attendance_records_sales", getAllAttendanceRecordsSales)
// app.post("/admin/hr/get_all_attendance_records_mentor", getAllAttendanceRecordsByMentor)
// app.post("/admin/hr/get_all_attendance_records_sales_man", getAllAttendanceRecordsBySalesMan)
// app.post("/admin/hr/get_date_range", getDateRangeRecords)
// app.post("/admin/hr/get_date_range_sales", getDateRangeRecordsSales)
// app.post("/admin/hr/get_salesman", getSalesmanById)
// app.post("/admin/get_all_reg_leads", authAdmin, GetAllRegFormLeads)
// app.get("/admin/get_new_reg_leads", authAdmin, GetNewRegFormLeads)
// app.get('/admin/groups', authAdmin, getAllGroupsAdmin)
// app.post('/admin/update_group_type', authAdmin, updateGroupType)
// app.delete('/admin/message/:messageId', authAdmin, deleteMessage)
// app.post('/admin/group/create_group_for_course', authAdmin, createGroupEndpoint);
// app.post('/admin/group/add_student_to_group', authAdmin, addGroupMemberEndpoint);
// app.post('/admin/get_session_analytics', authAdmin, getAllAnalyticsData);
// app.post("/admin/get_subject_by_id", authAdmin, GetSubjectById)
// //-----------------assets------------------------------------

// app.post('/admin/hr/asset_create', createAsset);
// // Get a single asset by ID
// app.post('/admin/hr/asset_get/:id', getAsset);
// // Update an asset by ID
// app.post('/admin/hr/asset_update/:id', updateAsset);
// // Get all assets
// app.post('/admin/hr/asset_get_all', getAllAssets);
// // AssetRecord Routes
// // Create a new asset record
// app.post('/admin/hr/asset_record_create', createAssetRecord);
// // Get a single asset record by ID
// app.post('/admin/hr/asset_record_get/:id', getAssetRecord);
// // Update an asset record by ID
// app.post('/admin/hr/asset_record_update/:id', updateAssetRecord);
// // Get all asset records
// app.post('/admin/hr/asset_record_get_all', getAllAssetRecords);
// // Get asset records by assetId
// app.post('/admin/hr/asset_record_get_by_asset_id/:assetId', getRecordsByAssetId);
// // Get asset records by condition (custom query)
// app.post('/admin/hr/asset_record_get_by_condition', getRecordsByCondition);
// // Get asset records with detailed asset information
// app.post('/admin/hr/asset_record_get_with_asset_details', getRecordsWithAssetDetails);


// app.use("/edtech", pythonApiProxy)
// //------------------ admin routes end here ------------------
// app.use("/leads", authAdmin, leadsRouter)
// // unclassfied routes ( mostly user though )
// app.post("/user", createUser);
// app.patch("/user", authUser, updateUser);
// app.delete("/user", authUser, SoftDeleteUser);
// app.post("/find_user", authUser, findUser)
// app.post("/update_device_id", updateUserDeviceId)
// app.post("/complete_user_reg", authUser, CompleteUserRegisteration);
// app.post("/login_user", generateAndSendOtpUser);
// app.post("/login_user2", generateAndSendOtpUser);
// app.patch("/mentor", authUser, authenticateTokenUser, updateMentor);
// app.post("/verify_otp_login_user", verifyOtpLoginUser);
// app.post("/mentor", authUser, InsertMentor);
// app.patch("/add_course", authenticateTokenUser, authUser, UpdateCourse);
// app.post("/lesson", authenticateTokenUser, authUser, InsertLessons);
// app.patch("/lesson", authenticateTokenUser, authUser, UpdateLessons);
// app.post("/get_user_assignments", authUser, GetUserAssingments);
// app.post("/get_courses", authUser, GetCoursesByGrade)
// //app.post("/get_course_detail", GetCourseDetail)
// app.post("/get_my_purchases", authUser, GetMyPurchases)
// app.post("/get_my_doubts", authUser, getMyDoubts)
// app.post("/create_doubt", authUser, insertDoubt)
// app.post("/assign_mentor_doubt", authUser, AssignMentor)
// app.patch("/update_doubt", authUser, updateDoubt)
// app.post("/get_messages", authUser, GetMessages)
// app.post("/mark_message_read", authUser, MarkMessageIDsRead)
// app.post("/submit_assignment", authUser, InsertSubmission)
// app.get("/otps", getRedisContents) // --------------- remove in prod ----------------------------
// app.post("/create_purchase", authUser, CreatePurchase)
// app.post("/get_mentor_by_class", authUser, GetMentorsByClasses)
// app.post("/get_mentor_by_subject", authUser, GetMentorBySubject)
// app.post("/get_mentor_details", authUser, GetMentorData)
// app.post("/get_offers_by_course", authUser, GetOfferByCourse)
// app.post("/get_my_messages", authUser, getMessagesByUUID)
// app.post("/get_participant_info", authUser, getChatPaticipantInfo)
// app.post("/get_my_mentors", authUser, GetMyMentors)
// app.post("/send_call_ios", ProdinitiateCallHandler)
// app.post("/send_call_ios_test", authUser, TestInitiateCallHandler)
// app.post("/get_chat_history_members", authUser, getChatHistoryParticipants)
// app.post("/get_conversation", authUser, GetConversationn)
// app.post("/get_my_uuid", authUser, GetMyUUID)
// app.post("/get_my_subscriptions", authUser, GetMySubscription)
// app.post("/create_subscription", authUser, InsertSubciption)
// app.post("/get_subscription_catalog", authUser, GetLtCourseCatalog)
// app.post("/get_subjects_by_grade", authUser, GetSubjectByGrade)
// app.post("/get_subsciption_by_subject_id", authUser, GetLtCourseCatalogBySubject)
// app.post("/get_my_submissions", authUser, GetMySubmissions)
// app.post("/get_user_ass2", authUser, GetUserAssignments2)
// app.post("/assignment_submission_with_file", authUser, InsertSubmissionWithFiles)
// app.post("/submit_mcq_responses", authUser, InsertAndCheckMcqResponses)
// app.post("/get_course_tests", authUser, GetTestByCourseId)
// app.post("/get_my_submissions", authUser, GetMySubmissions)
// app.post("/get_bg_course_info", authUser, GetBigCourses)
// app.post("/get_bg_course_info2", authUser, GetBigCourses2)
// app.post("/get_mentor_by_id", authUser, GetMentor)
// app.post("/submit_session_test", authUser, createSessionTestSubmission)
// app.post("/get_session_test_responses", authUser, GetSessionTestSubmissions)
// app.post("/create_big_course_subscription", authUser, createMgSubscription)//--------------------------------
// app.post('/mark_big_course_subscription_paid', authUser, markMgSubscriptionAsFullyPaid)
// app.post("/submit_course_test", authUser, SubmitCourseTestResponse)
// app.post("/get_my_test_response", authUser, getCourseTestResponses)
// app.post("/get_my_big_course_subcriptions", authUser, getMyBgCourseSubscriptions)
// app.post("/get_bg_course_by_id", authUser, GetBigCoursesById)
// app.post("/get_my_attendance_progress_report", authUser, GetMyAttendanceProgressReport)
// app.post("/get_my_session_test_submission", authUser, GetMySessionTestSubmission)
// app.post("/get_my_bigCourse_session_test_submissions", authUser, GetMyBigCourseSessionTestSubmissions)
// app.post("/get_my_bigCourse_session_test_submissions_date", authUser, GetMyBigCourseSessionTestSubmissionsByDate)
// app.post("/get_ctests", authUser, GetCtests)
// app.post("/get_qtests", authUser, Getqtests)
// app.post("/submit_ctest", authUser, createCtestSubmission)
// app.post("/submit_qtest", authUser, createqtestSubmission)
// app.post("/get_my_ctest_submissions", authUser, GetMyCtestSubmission)
// app.post("/get_my_qtest_submissions", authUser, GetMyqtestSubmission)
// app.post("/get_my_big_course_ctest_submissions", authUser, GetMyBigCourseCtestSubmission)
// app.post("/get_my_big_course_qtest_submissions", authUser, GetMyBigCourseqtestSubmission)
// app.post("/get_mg_subs", authUser, getMgSubscriptionsByUserId)
// app.post("/get_doubt_file_list", authUser, getDoubtFiles)
// app.post("/get_online_teachers", authUser, GetOnlineTeachersList)
// app.post("/get_all_boards", authUser, GetAllBoards)
// app.post("/get_combined_stats", authUser, GetCombinedStats)
// app.post("/get_materials", authUser, getMaterialFilesList)
// app.post("/get_materials_with_time", authUser, getMaterialFilesListwithTime)
// app.post("/get_user_notifications", authUser, GetUserNotifications)
// app.post("/get_my_profile", authUser, GetUserById)
// app.post("/get_subject_by_id", authUser, GetSubjectById)
// app.post("/get_stream_info", authUser, getStreamInfo)
// app.post("/get_my_purchases2", authUser, getMyPurchases2)
// app.post("/get_my_purchases3", authUser, getMgSubscriptionsByStudent);
// app.post("/get_student_ptms", authUser, GetStudentPtms)
// app.post("/insert_attendance", authUser, insertAttendanceRecord)
// app.post("/insert_attendance_exit", authUser, RecordAttendanceExitTime)
// app.post("/insert_mentor_rating", authUser, InsertMentorRating)
// app.post("/get_mentor_rating", authUser, GetMentorRatings)
// app.post("/create_order", authUser, createOrder)
// app.post("/create_inq", authUser, createInq)
// app.post("/mark_login_sales", authUser, markLoginSales)
// app.post("/mark_logout_sales", authUser, markLogoutSales)
// app.post("/get_token", authUser, callToken)
// app.post("/get_my_group", authUser, GetMyGroups)
// app.post("/edit_session", authUser, EditSession)
// app.post("/get_download_link", authUser, downlinkMessage)
// app.post("/new_reg_lead", createRegFormLeads) //website no auth
// app.post("/update_reg_lead", UpdateRegFormLeads) //website no auth
// app.post("/get_course_banners_list", authUser, getCourseBannerList)
// app.post("/generate_user_zego_token", authUser, genUserToken)
// app.post('/send-group-message', authUser, sendGroupMessage)
// app.post('/mark-read-group-message', authUser, markReadGroupMessage)
// app.get('/recent-group-message/:groupId', authUser, getRecentMessagesGroup)
// app.get('/:groupId/messages', authUser, getGroupMessages)
// app.get('/groups/:studentId', authUser, getStudentGroups)
// app.get('/messages/:messageId/read-receipts', authUser, getReadReciept)
// app.post('/get_feedback_status', authUser, getFeedbackStatus);
// app.post('/submit_feedback', authUser, submitFeedback);
// app.post('/get_course_feedback', authUser, authUser, getCourseFeedback);
// app.post('/create_ai_review', authUser, createAiReview)
// app.post('/get_ai_review', authUser, getAllAiReview)
// app.post("/get_banner_list", authUser, getFreeBannerList)
// app.post("/get_student_course_attendence_record", authUser, getStudentAttendanceRecords)
// app.post("/apn_token_update", UpdateApnToken);
// app.post("/send_msg_x", (request: Request, response: Response) => { sendMsgx(request.body.phone, request.body.template).then(_ => { response.json({ success: true }) }) })//

// // public routes
// app.post("/get_all_subjects_data", GetAllSubjectData)
// app.get("/public_course_list", GetLongTermCoursesPublicList)

// app.get("/info", function (_: Request, res: Response) {
//   res.send(process.version)
// })

// const onlineUsers = new Map<number, { socketId: string, groupId: number }>();

// // mediasoup worker
// let workers;
// async function initWorkers(): Promise<void> {
//   workers = await createWorkers() as Worker[];
//   console.log("Workers initialized:", workers);
// }

// initWorkers();

// // io.use(async (socket: CustomSocket, next) => {
// //   const token = socket.handshake.auth.token;
// //   console.log({ token });
// //   const id = socket.handshake.auth.id
// //   console.log({ id });

// //   if (!token || !id) {
// //     return next(new Error('Authentication error no token or id'));
// //   }

// //   jwt.verify(token, SECRET, (err: any, user: any) => {
// //     if (err) {
// //       console.log(err, token)
// //       return next(new Error('Authentication error:-' + err));
// //     }
// //     user.id = id
// //     if (user.user === "user") {
// //       try {
// //         const detail=prisma.endUsers.findUnique({

// //         })
// //         user.role = 'student';
// //         user.info=detail
// //       } catch (dbErr) {
// //         console.error("DB fetch error:", dbErr);
// //         return next(new Error("Authentication error: failed fetching user details"));
// //       }
// //     }
// //     socket.user = user;
// //     next();
// //   });
// // });

// io.use(async (socket: CustomSocket, next) => {
//   const token = socket.handshake.auth.token;
//   console.log({ token });
//   const id = socket.handshake.auth.id;
//   console.log({ id });

//   if (!token || !id) {
//     return next(new Error("Authentication error no token or id"));
//   }

//   jwt.verify(token, SECRET, async (err: any, user: any) => {
//     if (err) {
//       console.log(err, token);
//       return next(new Error("Authentication error:-" + err));
//     }

//     user.id = id;

//     if (user.user === "user") {
//       try {
//         console.log(`detail attaching`)
//         const detail = await prisma.endUsers.findFirst({
//           where: { uuid: id },
//           select: {
//             id: true,
//             email: true,
//             name: true,
//             uuid: true,
//           },
//         });

//         if (!detail) {
//           return next(new Error("Authentication error: user not found"));
//         }

//         user.role = "student";
//         user.info = detail;
//       } catch (dbErr) {
//         console.error("DB fetch error:", dbErr);
//         return next(
//           new Error("Authentication error: failed fetching user details")
//         );
//       }
//     }

//     socket.user = user;
//     next();
//   });
// });

// io.on('connection', (socket: CustomSocket) => {
//   SocketToUserIdMap.set(socket.user.id, socket.id)

//   classroomSocketHandler(io, socket, workers);

//   socket.on("set:role:teacher", () => {
//     console.log("set role called")
//     socket.role = "teacher"
//   })

//   // socket.on('disconnect', () => { SocketToUserIdMap.delete(socket.user.id) });
//   socket.on('disconnect', () => {
//     const entry = [...onlineUsers.entries()].find(([_, value]) => value.socketId === socket.id);

//     if (entry) {
//       const [memberId, { groupId }] = entry;

//       io.to(`group-${groupId}`).emit('presence-update', {
//         memberId,
//         status: 'offline'
//       });

//       onlineUsers.delete(memberId);
//     }

//     SocketToUserIdMap.delete(socket.user.id);
//   });


//   socket.on('send_message', ({ to, type, content }) => {
//     const senderId = SocketToUserIdMap.get(to)
//     if (senderId) {
//       insertMessage(to, socket.user.id, type, content, true)
//       socket.to(senderId).emit("accept_message", { type, content, from: socket.user.id })
//     } else { insertMessage(to, socket.user.id, type, content, false) }
//   });

//   socket.on("gc:message:send", ({ to, type, content }) => {
//     console.log(to, type, content)
//     insertMessage(to, socket.user.id, type, content, true)
//     socket.to(to).emit("gc:message:rescv", { type, content, from: socket.user.id, to })
//   })

//   socket.on("join", ({ roomId }) => { socket.join(roomId) })

//   socket.on("gc:message:server", ({ roomId, message }) => {
//     socket.to(roomId).emit("gc:message:client", { from: socket.user.id, sgc: roomId, message })
//   })

//   socket.on("send:room:event", ({ sessionRoomId, data }) => {
//     socket.to(sessionRoomId).emit("room:event", data)
//   })

//   socket.on("student:join:room", ({ sessionRoomId, data }) => {
//     socket.join(sessionRoomId)
//     socket.to(sessionRoomId).emit("student:announce", data)
//   })
//   socket.on("gc:add:participant", ({ uuid, groupId }) => {
//     insertMessage(groupId, uuid, "group_join", `joined group at ${new Date().toISOString()}`, false)
//   })


//   // ----------------------- stream info -------------------
//   // token is stream id token given by zego
//   socket.on("join:session", ({ token }) => { socket.join(token) })
//   socket.on("broadcast:session", ({ token, data }) => { socket.to(token).emit("recieve:session", data) })
//   socket.on("toggle:mic:teacher", ({ token, data }) => { socket.to(token).emit("toggle:mic:student", data) })
//   socket.on("request:mic:student", ({ token, data }) => { socket.to(token).emit("request:mic:teacher", data) })
//   socket.on("request:end:call", ({ token, data }) => { socket.to(token).emit("end:call", data) })
//   socket.on("class:end", ({ token, data }) => { socket.to(token).emit("class:end", data) })
//   socket.on("teacher:announce", ({ token, data }) => { socket.to(token).emit("announcement", data) })
//   socket.on("toggle:doubt:status", ({ doubtId, status }) => { prisma.doubt.update({ where: { id: doubtId }, data: { status } }) })


//   // --------- Group Chat -----------
//   socket.on('join-group', async ({ groupId, memberId }: { groupId: number; memberId: number }) => {
//     console.log(`joing group ${groupId} & ${memberId}`)
//     socket.join(`group-${groupId}`);

//     onlineUsers.set(memberId, { socketId: socket.id, groupId });

//     console.log("Updating lastSeen for memberId:", memberId);

//     await prisma.groupMember.update({
//       where: { id: memberId },
//       data: { lastSeen: new Date() }
//     });

//     io.to(`group-${groupId}`).emit('presence-update', {
//       memberId,
//       status: 'online'
//     });
//   });

//   socket.on('send-message', async (msg) => {
//     const group = await prisma.groupChat.findUnique({
//       where: { id: msg.groupId },
//       include: { members: true },
//     });

//     if (!group) return;

//     const member = group.members.find((m) => m.id === msg.senderId);
//     if (!member) return;

//     const allowed =
//       (group.groupType === "ALL") ||
//       (group.groupType === "MENTOR" && (member.adminId || member.mentorId)) ||
//       (group.groupType === "ADMIN_ONLY" && !!member.adminId);

//     if (!allowed) return;

//     const senderName = await getNameByType(msg.senderId, msg.senderType);

//     let content = msg.content || '';
//     let imageUrl = null;

//     if (msg.imageData) {
//       const timestamp = Date.now();
//       await uploadImage(msg.imageData, timestamp, 'group');
//       imageUrl = `https://sisyabackend.in/student/thumbs/group/${timestamp}.jpg`;
//     }

//     console.log(msg);

//     const message = await prisma.groupMessage.create({
//       data: {
//         content: content,
//         senderId: msg.senderId,
//         senderType: msg.senderType,
//         senderName,
//         groupId: msg.groupId,
//         deliveredAt: new Date(),
//         imageUrl,
//         readBy: {
//           create: [{ memberId: msg.senderId, readAt: new Date() }]
//         }
//       },
//       include: {
//         readBy: true
//       }
//     });

//     io.to(`group-${msg.groupId}`).emit('new-message', message);

//     console.log(`2--2`)

//     io.to(`group-${msg.groupId}`).emit('update-read-receipts', {
//       messageId: message.id,
//       readBy: message.readBy
//     });


//     const groupMembers = await prisma.groupMember.findMany({
//       where: { groupId: msg.groupId },
//       include: {
//         user: { select: { deviceId: true } },
//         mentor: { select: { deviceId: true } },
//         admin: { select: { deviceId: true } },
//       }
//     });

//     const offlineMembers = groupMembers.filter(member =>
//       !onlineUsers.has(member.id) &&
//       (member.user?.deviceId?.trim() || member.mentor?.deviceId?.trim() || member.admin?.deviceId?.trim())
//     );

//     if (offlineMembers.length > 0) {
//       const notificationPromises = offlineMembers.map(async (member) => {
//         let deviceId: string = '';
//         let userType = '';

//         if (member.user?.deviceId && member.user.deviceId.trim()) {
//           deviceId = member.user.deviceId.trim();
//           userType = 'STUDENT';
//         } else if (member.mentor?.deviceId && member.mentor.deviceId.trim()) {
//           deviceId = member.mentor.deviceId.trim();
//           userType = 'MENTOR';
//         } else if (member.admin?.deviceId && member.admin.deviceId.trim()) {
//           deviceId = member.admin.deviceId.trim();
//           userType = 'ADMIN';
//         }

//         if (!deviceId) return;

//         const notificationBody = content
//           ? `${senderName}: ${content.slice(0, 100)}${content.length > 100 ? '...' : ''}`
//           : `${senderName} sent an image`;

//         const notificationData = {
//           tokens: [deviceId],
//           notification: {
//             title: group.groupChatName || 'New Message',
//             body: notificationBody,
//             imageUrl: imageUrl || undefined
//           }
//         };

//         try {
//           await fetch('http://localhost:4000/admin/send_notif2', {
//             method: 'POST',
//             headers: { 'Content-Type': 'application/json' },
//             body: JSON.stringify(notificationData)
//           });
//         } catch (error) {
//           console.error('Notification send error:', error);
//         }
//       });

//       await Promise.allSettled(notificationPromises);
//     }


//   });

//   socket.on('mark-read', async ({ messageId, memberId }) => {
//     const receipt = await prisma.readReceipt.create({
//       data: {
//         messageId,
//         memberId,
//         readAt: new Date()
//       }
//     });

//     io.emit('message-read', receipt);
//   });

//   socket.on('delete-message', async ({ messageId, deletedBy }) => {
//     const message = await prisma.groupMessage.update({
//       where: { id: messageId },
//       data: {
//         deleted: true,
//         deletedBy
//       }
//     });

//     io.to(`group-${message.groupId}`).emit('message-deleted', message.id);
//   });

//   socket.on('mark-messages-read', async ({ memberId, messageIds }) => {
//     console.log(`${memberId}-mes${messageIds}`)
//     try {
//       await prisma.readReceipt.deleteMany({
//         where: {
//           memberId,
//           messageId: { in: messageIds }
//         }
//       });

//       await prisma.readReceipt.createMany({
//         data: messageIds.map((messageId: any) => ({
//           messageId,
//           memberId,
//           readAt: new Date()
//         }))
//       });

//       const group = await prisma.groupMessage.findFirst({
//         where: { id: { in: messageIds } },
//         select: { groupId: true }
//       });

//       if (group) {
//         console.log(`done bro`)
//         io.to(`group-${group.groupId}`).emit('messages-read', {
//           memberId,
//           messageIds
//         });
//       }
//     } catch (err) {
//       console.error('Error marking messages as read:', err);
//     }
//   });

//   socket.on('group-type-change', ({ groupId, groupType }) => {
//     io.to(`group-${groupId}`).emit('group-type', {
//       groupType
//     });
//   })
// });

// function GetOnlineTeachers() {
//   const tList: (number | undefined | string)[] = []
//   io.sockets.sockets.forEach((socket: CustomSocket) => {
//     if (socket.role == "teacher") {
//       tList.push(socket.user.id)
//     }
//   })
//   return tList
// }

// async function GetOnlineTeachersList(_: Request, res: Response) {
//   res.json({ success: true, tlist: GetOnlineTeachers() })
// }
// server.listen(4000, '0.0.0.0', () => { console.log(logMessageServer) });

// process.on('SIGINT', () => {
//   console.log('Shutting down APNs provider...');
//   ProdApnProvider.shutdown();
//   process.exit(0);
// });