import { prisma } from './misc'
const MAX_FETCH_ATTEMPTS = 5 + 1
const skip = 1
const take = 1000
export async function getUsers(id: number, depth = 0) {
    const users = await prisma.endUsers.findMany({ cursor: { id }, take, skip })
    if (users.length == 0 && depth < MAX_FETCH_ATTEMPTS)
        return getUsers(++id, ++depth)

    return users
}

