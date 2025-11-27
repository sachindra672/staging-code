import { prisma } from './misc'
import { Request, Response } from 'express'
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

function formatClass(cf_class: string): string {
    const match = cf_class?.match(/(\d{1,2})/);
    if (!match) return "";
    const num = parseInt(match[1], 10);

    let suffix = "th";
    if (num % 10 === 1 && num % 100 !== 11) suffix = "st";
    else if (num % 10 === 2 && num % 100 !== 12) suffix = "nd";
    else if (num % 10 === 3 && num % 100 !== 13) suffix = "rd";

    return `Class ${num}${suffix}`;
}


const nanoIdToNameMap: Record<string, string> = {
    zR1Oe4X8vjD0: "Madhumita",
    G9kt2s6qWmXE: "Khyati Narang Gupta",
    YOD2fPv9JmiK: "Jassimran",
    gW3DhRr7ZUbT: "Honey Vijay",
    dADK3UoObgbB: "Vishakha Chopra",
    vtyXAHb5FLXJ: "Anushka Jain",
    EyJgbGp6n7nT: "Harneet Kaur",
    UdMK8Dp3rFg1: "Anandita Banerjee",
    NmMJtQCGdOX1: "Gagan Midha",
};

export async function createRegFormLeads(req: Request, res: Response) {
    try {
        const { ref_id, ...rest } = req.body;

        const referredBy = ref_id ? nanoIdToNameMap[ref_id] ?? null : null;

        const lead = await prisma.regterationLeads.create({
            data: {
                ...rest,
                referredBy,
                ref_id,
            },
        });

        res.json({ success: true, lead });
    } catch (e) {
        console.error("Error creating lead:", e);
        res.status(500).json({ success: false, error: "Internal server error" });
    }
}

export async function createRegFormLeads2(req: Request, res: Response) {
    try {
        const { ref_id, name, phone, courseName, cf_class,state,source,medium, ...rest } = req.body;

        console.log({cf_class})

        const referredBy = ref_id ? nanoIdToNameMap[ref_id] ?? null : null;

        const formattedClass = formatClass(cf_class);
        console.log("Formatted class:", formattedClass);

        const lead = await prisma.regterationLeads.create({
            data: {
                ...rest,
                name,
                phone,
                courseName,
                referredBy,
                ref_id,
                class: formattedClass,
            },
        });

        try {
            console.log({courseName,phone,formattedClass,state});
            const npfResponse = await axios.post(
                "https://api.nopaperforms.io/lead/v1/create",
                {
                    name: 'SISYA STUDENT',
                    mobile: phone,
                    cf_status: "initiated",
                    cf_class: formattedClass,
                    cf_board: "CBSE",
                    // city: "Visakhapatnam",
                    state: 'Andhra Pradesh',
                    email: `${`email`}${phone}@gmail.com`,
                    source: source,
                    medium:medium,
                    campaign:name
                },
                {
                    headers: {
                        "Content-Type": "application/json",
                        "Access-Key": process.env.NPF_ACCESS_KEY as string,
                        "Secret-Key": process.env.NPF_SECRET_KEY as string,
                    },
                }
            );

            console.log(`merrito response`,JSON.stringify(npfResponse.data));

            const merrittoId = npfResponse.data?.data.lead_id;

            console.log(`lead id ${merrittoId}`)

            if (merrittoId) {
                await prisma.regterationLeads.update({
                    where: { id: lead.id },
                    data: { merrittoId },
                });
            }
        } catch (npfErr: any) {
            console.error(
                "Error sending data to Nopaperforms:",
                npfErr.response?.data || npfErr.message
            );
        }

        res.json({ success: true, lead });
    } catch (e) {
        console.error("Error creating lead:", e);
        res.status(500).json({ success: false, error: "Internal server error" });
    }
}

export async function createRegFormLeads3(req: Request, res: Response) {
    try {
        const { ref_id, name, phone, courseName, cf_class, state, source, medium, ...rest } = req.body;

        if (!phone) {
            return res.status(400).json({ success: false, error: "Phone number is required" });
        }

        // 🔍 Check if phone already exists
        const existingLead = await prisma.regterationLeads.findFirst({
            where: { phone },
        });

        if (existingLead) {
            return res.status(409).json({
                success: false,
                error: "Phone number already exists",
            });
        }

        const referredBy = ref_id ? nanoIdToNameMap[ref_id] ?? null : null;

        const formattedClass = formatClass(cf_class);

        const lead = await prisma.regterationLeads.create({
            data: {
                ...rest,
                name,
                phone,
                courseName,
                referredBy,
                ref_id,
                class: formattedClass,
            },
        });

        try {
            const npfResponse = await axios.post(
                "https://api.nopaperforms.io/lead/v1/create",
                {
                    name: "SISYA STUDENT",
                    mobile: phone,
                    cf_status: "initiated",
                    cf_class: formattedClass,
                    cf_board: "CBSE",
                    state: "Andhra Pradesh",
                    email: `email${phone}@gmail.com`,
                    source: source,
                    medium: medium,
                    campaign: name,
                },
                {
                    headers: {
                        "Content-Type": "application/json",
                        "Access-Key": process.env.NPF_ACCESS_KEY as string,
                        "Secret-Key": process.env.NPF_SECRET_KEY as string,
                    },
                }
            );

            const merrittoId = npfResponse.data?.data.lead_id;

            if (merrittoId) {
                await prisma.regterationLeads.update({
                    where: { id: lead.id },
                    data: { merrittoId },
                });
            }
        } catch (npfErr: any) {
            console.error(
                "Error sending data to Nopaperforms:",
                npfErr.response?.data || npfErr.message
            );
        }

        res.json({ success: true, lead });
    } catch (e) {
        console.error("Error creating lead:", e);
        res.status(500).json({ success: false, error: "Internal server error" });
    }
}


interface MerrittoLeadData {
    name: string;
    phone: string;
    formattedClass: string;
    state?: string;
    source?: string;
    medium?: string;
    campaign?: string;
    email?: string;
    message?: string
}

export async function sendLeadToMerritto(data: MerrittoLeadData): Promise<string | null> {
    try {
        const { name, phone, email, formattedClass, state, source, medium, campaign, message } = data;

        const npfResponse = await axios.post(
            "https://api.nopaperforms.io/lead/v1/create",
            {
                name: name || "SISYA STUDENT",
                mobile: phone,
                cf_status: "initiated",
                cf_class: formattedClass,
                cf_board: "CBSE",
                state: state || "Andhra Pradesh",
                email: email || `email${phone}@gmail.com`,
                source,
                medium,
                campaign,
                cf_message:message
            },
            {
                headers: {
                    "Content-Type": "application/json",
                    "Access-Key": process.env.NPF_ACCESS_KEY as string,
                    "Secret-Key": process.env.NPF_SECRET_KEY as string,
                },
            }
        );

        console.log("Merritto response:", JSON.stringify(npfResponse.data));
        return npfResponse.data?.data?.lead_id || null;
    } catch (err: any) {
        console.error("Error sending data to Merritto:", err.response?.data || err.message);
        throw err;
    }
}

export async function createMerrittoLead(req: Request, res: Response) {
    try {
        const { name, phone, cf_class, state, source, medium, campaign, email, message } = req.body;

        if (!phone || !cf_class) {
            return res.status(400).json({ success: false, error: "Missing required fields: phone or cf_class" });
        }

        const formattedClass = formatClass(cf_class);

        const merrittoId = await sendLeadToMerritto({
            name,
            phone,
            formattedClass,
            state,
            source,
            medium,
            campaign,
            email,
            message
        });

        if (!merrittoId) {
            return res.status(400).json({ success: false, message: "Lead not created on Merritto" });
        }

        res.json({
            success: true,
            message: "Lead successfully created on Merritto",
            merrittoId,
        });
    } catch (error: any) {
        console.error("Error creating Merritto lead:", error.response?.data || error.message);
        res.status(500).json({ success: false, error: "Failed to send lead to Merritto" });
    }
}

export async function UpdateRegFormLeads(req: Request, res: Response) {
    try {
        const { id, ...rest } = req.body
        const lead = await prisma.regterationLeads.update({ where: { id }, data: rest })
        res.json({ success: true, lead })
    } catch (e) {
        res.json({ success: false, error: e })
    }
}

export async function UpdateRegFormLeads2(req: Request, res: Response) {
    try {
        const { id, ...rest } = req.body
        const lead = await prisma.regterationLeads.update({ where: { id }, data: rest })

        try {
            const statusUpper = (rest.status as string)?.toUpperCase();
            console.log({ lead, "merId": lead.merrittoId, "status": statusUpper })
            const npfUpdateResponse = axios.post('https://api.nopaperforms.io/lead/v1/update',{
                lead_id:lead.merrittoId,
                cf_status: statusUpper
            },
            {
                headers: {
                    "Content-Type": "application/json",
                    "Access-Key": process.env.NPF_ACCESS_KEY as string,
                    "Secret-Key": process.env.NPF_SECRET_KEY as string,
                },
            });

            console.log(`merrito response`, JSON.stringify(npfUpdateResponse));

        } catch (npfErr) {
            console.error(
                "Error updating data to Nopaperforms:",
                npfErr.response?.data || npfErr.message
            );
        }
        res.json({ success: true, lead })
    } catch (e) {
        res.json({ success: false, error: e })
    }
}

export async function GetAllRegFormLeads(_: Request, res: Response) {
    try {
        const leads = await prisma.regterationLeads.findMany()
        res.json({ success: true, leads })
    } catch (e) {
        res.json({ success: false, error: e })
    }
}

export async function GetNewRegFormLeads(req: Request, res: Response) {
    try {
        const { after } = req.query;

        const leads = await prisma.regterationLeads.findMany({
            where: {
                createdOn: {
                    gt: after ? new Date(after as string) : new Date('2025-07-22T00:00:00.000Z'),
                },
            },
            orderBy: {
                createdOn: 'desc',
            },
            select: {
                name: true,
                phone: true,
                class: true,
                status: true,
                courseName: true,
                referredBy: true,
                createdOn: true,
            },
        });

        res.json({ success: true, leads });
    } catch (e) {
        res.status(500).json({ success: false, error: String(e) });
    }
}

export async function createLeadQuizQuestion(req: Request, res: Response) {
    try {
        const { question, type, options } = req.body;

        if (!question || !type) {
            return res.status(400).json({ success: false, message: "Question and type are required" });
        }

        const newQuestion = await prisma.leadQuizQuestion.create({
            data: {
                question,
                type,
                options: options ? JSON.stringify(options) : null,
            },
        });

        res.status(201).json({ success: true, question: newQuestion });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Error creating quiz question" });
    }
}

export async function getLeadQuizQuestions(_req: Request, res: Response) {
    const questions = await prisma.leadQuizQuestion.findMany();
    res.json(questions);
}

export async function submitLeadQuizResponses(req: Request, res: Response) {
    const { leadId, responses } = req.body;

    try {
        const saved = await prisma.leadQuizResponse.createMany({
            data: responses.map((r: any) => ({
                leadId,
                questionId: r.questionId,
                answer: r.answer,
            })),
        });

        res.json({ success: true, saved });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Error saving responses" });
    }
}

export async function getLeadQuizResponses(req: Request, res: Response) {
    const { leadId } = req.body;

    const responses = await prisma.leadQuizResponse.findMany({
        where: { leadId },
        include: { question: true },
    });

    res.json(responses);
}



