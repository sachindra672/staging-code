//import { v4 as uuidv7 } from 'uuid';
import { prisma } from "../src/misc"

//const MAX_FETCH_ATTEMPTS = 5 + 1

// interface EndUser {
//     type: string;
//     name: string;
//     email: string;
//     address: string;
//     phone: string;
//     grade: number;
//     password: string;
//     isVerified: boolean;
// }
// function generateEndUserSeed(numUsers: number, offset: number): EndUser[] {
//     const users: EndUser[] = [];
//     for (let i = offset; i < numUsers; i++) {
//         users.push({
//             type: "student",
//             name: `User ${i + 1}`,
//             email: `user${i + 1}@example.com`,
//             address: "123 Main St",
//             phone: `127890${i}`,
//             grade: Math.floor(Math.random() * 12) + 1,
//             password: "password123",
//             isVerified: false,
//         });
//     }
//     return users;
// }

// async function getUsers(cursor: number, depth = 0) {
//     const users = await prisma.endUsers.findMany({
//         cursor: { id: cursor },
//         take: 100,
//         skip: 1,
//         orderBy: { createdOn: "desc" }
//     })

//     if (users.length == 0 && depth < MAX_FETCH_ATTEMPTS) return getUsers(++cursor, ++depth)
//     return users
// }


async function generateTestData() {
    const usersUUIDs = Array.from(['73960c18-71de-4ea7-a312-0b7ae4abe72d', '73960c18-71de-4ea7-a312-0b7ae4abe72d', '03643875-eccd-4f39-89e5-0e090f135bac', '8eabff49-ac0c-4262-a960-15bd5db153a1']);
    const messages: {
        toUUID: string;
        fromUUID: string;
        type: string;
        content: string;
        isRead: boolean;
    }[] = [];

    for (let i = 0; i < 1000; i++) {
        const toUUID = usersUUIDs[Math.floor(Math.random() * usersUUIDs.length)];
        const fromUUID = usersUUIDs[Math.floor(Math.random() * usersUUIDs.length)];

        messages.push({
            toUUID,
            fromUUID,
            type: 'text',
            content: `Message content ${i}`,
            isRead: Math.random() < 0.5,
        });
    }


    await prisma.messages.createMany({
        data: messages,
    })
};
async function main() {
    // const users = generateEndUserSeed(1000, 10)

    // for (const user of users)
    //     await prisma.endUsers.create({ data: user })

    // const users = await getUsers(990)

    // console.log(users.length)
    // for (const user of users) {
    //     console.log(user)
    // }


    generateTestData()
        .catch((e) => {
            console.error(e);
            process.exit(1);
        })
        .finally(async () => {
            await prisma.$disconnect();
        });

}

main()
    .catch((error) => {
        console.error('Error during seeding:', error);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect()
    });