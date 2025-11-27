import { Request, Response } from 'express';
import { prisma } from './misc';

export async function addQuizWithQuestions(req: Request, res: Response) {
    try {
        const { sessionId, questions } = req.body;

        const quiz = await prisma.quiz.create({
            data: {
                session: { connect: { id: sessionId } },
                questions: {
                    create: questions.map((q: any) => {
                        const questionData: any = {
                            type: q.type,
                            questionId: q.questionId,
                            correctAnswer: q.correctAnswer,
                        };

                        if (q.question) {
                            questionData.question = q.question;
                        }

                        return questionData;
                    }),
                },
            },
            include: { questions: true },
        });

        res.status(201).json(quiz);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to create quiz" });
    }
}


export async function quizQuestionResponse(req: Request, res: Response) {
    try {
        const { questionId, userId, selectedAnswer, timeTakenMs } = req.body;

        const question = await prisma.question.findUnique({
            where: { id: questionId },
        });

        if (!question) return res.status(404).json({ error: "Question not found" });

        const response = await prisma.response.create({
            data: {
                question: { connect: { id: questionId } },
                user: { connect: { id: userId } },
                selectedAnswer,
                isCorrect: selectedAnswer === question.correctAnswer,
                timeTakenMs,
            },
        });

        res.status(201).json(response);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to submit response" });
    }
}