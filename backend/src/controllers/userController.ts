import { Request, Response } from 'express';
import bcrypt from 'bcrypt';

import type { User } from '../generated/prisma/client.js';
import { getContexto } from '../middlewares/load-context.js';
import userRepository from '../repositories/userRepository.js';

function serializeUser(user: User) {
  return {
    id: user.id.toString(),
    name: user.name,
    email: user.email,
    active: user.active,
    createdAt: user.createdAt,
  };
}

async function getUsers(req: Request, res: Response) {
  try {
    const { organizacaoId } = getContexto(req);
    const users = await userRepository.findAllByOrganization(organizacaoId);

    return res.json(users.map(serializeUser));
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      erro: 'Erro ao buscar usuários',
    });
  }
}

async function getUserById(req: Request, res: Response) {
  try {
    const { id: idParam } = req.params;

    if (!idParam || Array.isArray(idParam)) {
      return res.status(400).json({
        erro: 'ID de usuário inválido',
      });
    }

    const id = BigInt(idParam);

    //const id = BigInt(req.params.id)

    const user = await userRepository.findByIdInOrganization(id, getContexto(req).organizacaoId);

    if (!user) {
      return res.status(404).json({
        erro: 'Usuário não encontrado',
      });
    }

    return res.json(serializeUser(user));
  } catch (error) {
    console.error(error);

    return res.status(400).json({
      erro: 'ID de usuário inválido',
    });
  }
}

async function createUser(req: Request, res: Response) {
  try {
    const { name, email, password, active } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        erro: 'Nome, e-mail e senha são obrigatórios',
      });
    }

    const existingUser = await userRepository.findByEmail(email);

    if (existingUser) {
      return res.status(400).json({
        erro: 'E-mail já cadastrado',
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await userRepository.create({
      name,
      email,
      passwordHash,
      active,
    });

    return res.status(201).json(serializeUser(user));
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      erro: 'Erro ao criar usuário',
    });
  }
}

async function updateUser(req: Request, res: Response) {
  try {
    const { id: idParam } = req.params;

    if (!idParam || Array.isArray(idParam)) {
      return res.status(400).json({
        erro: 'ID de usuário inválido',
      });
    }

    const id = BigInt(idParam);

    //const id = BigInt(req.params.id)

    const { name, email, password, active } = req.body;

    const existingUser = await userRepository.findByIdInOrganization(
      id,
      getContexto(req).organizacaoId,
    );

    if (!existingUser) {
      return res.status(404).json({
        erro: 'Usuário não encontrado',
      });
    }

    if (email && email !== existingUser.email) {
      const emailInUse = await userRepository.findByEmail(email);

      if (emailInUse) {
        return res.status(400).json({
          erro: 'E-mail já cadastrado',
        });
      }
    }

    const data: {
      name?: string;
      email?: string;
      passwordHash?: string;
      active?: boolean;
    } = {};

    if (name !== undefined) {
      data.name = name;
    }

    if (email !== undefined) {
      data.email = email;
    }

    if (password !== undefined) {
      data.passwordHash = await bcrypt.hash(password, 10);
    }

    if (active !== undefined) {
      data.active = active;
    }

    const updatedUser = await userRepository.update(id, data);

    return res.json(serializeUser(updatedUser));
  } catch (error) {
    console.error(error);

    return res.status(400).json({
      erro: 'Erro ao atualizar usuário',
    });
  }
}

async function deleteUser(req: Request, res: Response) {
  try {
    const { id: idParam } = req.params;

    if (!idParam || Array.isArray(idParam)) {
      return res.status(400).json({
        erro: 'ID de usuário inválido',
      });
    }

    const id = BigInt(idParam);

    //const id = BigInt(req.params.id)

    const existingUser = await userRepository.findByIdInOrganization(
      id,
      getContexto(req).organizacaoId,
    );

    if (!existingUser) {
      return res.status(404).json({
        erro: 'Usuário não encontrado',
      });
    }

    await userRepository.deleteById(id);

    return res.status(204).send();
  } catch (error) {
    console.error(error);

    return res.status(400).json({
      erro: 'Não foi possível excluir o usuário',
    });
  }
}

export default {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
};
