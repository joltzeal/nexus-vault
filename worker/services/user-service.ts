import { notFound } from "../lib/errors"
import type { Actor, Db } from "../types/legacy-api"
import {
  findUserIdByEmail,
  findUserIdById,
  updateUserProfile,
} from "../repositories/user.repository"

export async function ensureUser(
  db: Db,
  input: {
    email: string
    name?: string
  }
) {
  const existingId = await findUserIdByEmail(db, input.email)
  if (existingId) return existingId

  throw notFound("该用户尚未注册，无法添加为协作者。")
}

export async function ensureActorUser(db: Db, actor: Actor) {
  const existingById = await findUserIdById(db, actor.id)
  if (existingById) {
    await updateUserProfile(db, actor.id, {
      email: actor.email,
      name: actor.name || actor.email,
    })
    return existingById
  }

  const existingByEmail = await findUserIdByEmail(db, actor.email)
  if (existingByEmail) {
    await updateUserProfile(db, existingByEmail, { name: actor.name || actor.email })
    return existingByEmail
  }

  throw notFound("当前登录用户不存在，请重新登录。")
}
