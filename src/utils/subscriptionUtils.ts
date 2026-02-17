import { prisma } from "../misc";

/**
 * Returns a Prisma filter for subjectId based on the user's subscription.
 * If the user has full course access, it returns an empty object.
 * If the user has a bundle, it returns { subjectId: { in: bundle.subjectIds } }.
 */
/**
 * Returns a Prisma filter for subjectId based on the user's subscription.
 * If the user has full course access or is an admin/mentor, it returns an empty object.
 */
export async function getUserSubjectFilter(user: any, role: string | undefined, bigCourseId: number) {
    console.log(`[SubjectFilter] Entering for user: ${JSON.stringify(user)}, role: ${role}, bigCourseId: ${bigCourseId}`);
    // Mentors and Admins see everything
    if (role !== "user" || !user) {
        return {};
    }

    let endUsersId: number;
    if (typeof user === "number") {
        endUsersId = user;
    } else if (typeof user === "string" && !isNaN(Number(user))) {
        endUsersId = Number(user);
    } else if (user && user.id) {
        endUsersId = Number(user.id);
    } else if (user && user.user) {
        // Fallback for when req.user only has the phone (as per auth.ts for users)
        const dbUser = await prisma.endUsers.findUnique({
            where: { phone: user.user.toString() },
            select: { id: true }
        });
        if (!dbUser) return { id: -1 };
        endUsersId = dbUser.id;
    } else {
        // If we can't identify the user, we should probably restrict access if it's a "user" role
        return role === "user" ? { id: -1 } : {};
    }

    const subscription = await prisma.mgSubsciption.findUnique({
        where: {
            endUsersId_bigCourseId: {
                endUsersId: endUsersId,
                bigCourseId: bigCourseId,
            }
        },
        include: {
            bigCourseBundle: true
        }
    });

    if (!subscription || !subscription.isActive) {
        console.log(`[SubjectFilter] User ${endUsersId} in course ${bigCourseId}: NO ACTIVE SUBSCRIPTION`);
        return { subjectId: -1 };
    }

    // Prioritize Bundle if it exists, even if isFullCourse is true (safer for restricted paths)
    if (subscription.bigCourseBundle && subscription.bigCourseBundle.subjectIds.length > 0) {
        const ids = subscription.bigCourseBundle.subjectIds;
        console.log(`[SubjectFilter] User ${endUsersId} in course ${bigCourseId}: BUNDLE "${subscription.bigCourseBundle.name}" (IDs: ${ids.join(',')})`);
        return { subjectId: { in: ids } };
    }

    if (subscription.isFullCourse) {
        console.log(`[SubjectFilter] User ${endUsersId} in course ${bigCourseId}: FULL COURSE ACCESS`);
        return {};
    }

    console.log(`[SubjectFilter] User ${endUsersId} in course ${bigCourseId}: NO BUNDLE OR EMPTY`);
    return { subjectId: -1 };
}
