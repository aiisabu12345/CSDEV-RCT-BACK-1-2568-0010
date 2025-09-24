import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { mustAuth } from "../middleware/mustAuth.js";
import { config } from 'dotenv'
import AWS from 'aws-sdk'
import { parse } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import s3UploadStream from 's3-upload-stream'
import { PrismaClient } from "@prisma/client";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import * as v from 'valibot'
import { describeRoute, resolver, validator } from 'hono-openapi'

config()
const prisma = new PrismaClient()
const bucketRouter = new Hono();

AWS.config.s3 = {
  endpoint: process.env.S3_ENDPOINT,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY
  }
}


const ImageSchema = v.object({ file: v.any() })

const inputImage = validator('form',ImageSchema);

const s3Stream = s3UploadStream(new AWS.S3() as any)

bucketRouter.post(
  '/fs',
  describeRoute({
    description: 'Upload an image file to the S3 bucket. Requires authentication.',
    responses: {
      200: {
        description: 'Image uploaded successfully',
        content: {
          'application/json': { schema: resolver(v.object({ message: v.string() })) },
        },
      },
      400:{
        description: 'Bad request',
        content: {
          'application/json': { schema: resolver(v.object({ message: v.string() })) },
        },
      },
    },
  }),
  mustAuth,
  inputImage,
  async (c) => {
    const body = await c.req.parseBody()
    if (!(body.file instanceof File)) {
    throw new HTTPException(400, { message: 'Invalid file' })
    }
    const output = `${Date.now()}-${parse(body.file.name).name}.jpg`

    await prisma.image.create({
      data: {
        imageName: output,
        size: body.file.size,
        userId: c.get('userId'),
      }
    });

    const webReadStream = body.file.stream()
    const nodeReadStream = Readable.from(webReadStream as any)
    const upload = s3Stream.upload({
        Bucket: process.env.S3_BUCKET,
        Key: output
    })
    await pipeline(nodeReadStream, upload)
    return c.json({ message: 'file uploaded successfully', path: output })
  }
)

const s3 = new S3Client({
  region: "auto",
  endpoint: process.env.S3_ENDPOINT,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  },
});

bucketRouter.get(
  '/fs/:key',
  describeRoute({
    description: 'Retrieve a file from the S3 bucket by file name',
    responses:{
      200: {
        description: 'File retrieved successfully',
        content: {
          'application/octet-stream': {
            schema: { type: 'string', format: 'binary' }
          },
          'image/jpeg': {
            schema: { type: 'string', format: 'binary' }
          }
        },
      },
      400: {
        description: 'Bad request or file not found',
        content: {
          'application/json': { schema: resolver(v.object({ message: v.string() })) },
        },
      },
    },
  }),
  mustAuth,
  async (c) => {
    const key = c.req.param("key");

    const command = new GetObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: key,
    });

    const res = await s3.send(command);

    if (!res.Body) {
      return c.json({ message: 'File not found' }, 400)
    }

    return c.body(res.Body as any, 200, {
      "Content-Type": res.ContentType || "application/octet-stream",
    });
  }
)

export default bucketRouter