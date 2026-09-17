import { prisma } from '../database/client.js';

async function findAll() {
  return prisma.user.findMany({
    orderBy: {
      createdAt: 'desc',
    },
  });
}

// Usuarios visiveis sao os que tem vinculo ativo com a organizacao de quem consulta.
async function findAllByOrganization(organizationId: bigint) {
  return prisma.user.findMany({
    where: {
      memberships: {
        some: {
          organizationId,
          active: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
}

async function findByIdInOrganization(id: bigint, organizationId: bigint) {
  return prisma.user.findFirst({
    where: {
      id,
      memberships: {
        some: {
          organizationId,
          active: true,
        },
      },
    },
  });
}

async function findById(id: bigint) {
  return prisma.user.findUnique({
    where: {
      id,
    },
  });
}

async function findByEmail(email: string) {
  return prisma.user.findUnique({
    where: {
      email,
    },
  });
}

async function create(data: {
  name: string;
  email: string;
  passwordHash: string;
  active?: boolean;
  createdAt?: Date;
}) {
  return prisma.user.create({
    data: {
      name: data.name,
      email: data.email,
      passwordHash: data.passwordHash,
      active: data.active ?? true,
      createdAt: data.createdAt ?? new Date(),
    },
  });
}

async function update(
  id: bigint,
  data: {
    name?: string;
    email?: string;
    passwordHash?: string;
    active?: boolean;
  },
) {
  return prisma.user.update({
    where: {
      id,
    },
    data,
  });
}

async function deleteById(id: bigint) {
  return prisma.user.delete({
    where: {
      id,
    },
  });
}

export default {
  findAll,
  findAllByOrganization,
  findByIdInOrganization,
  findById,
  findByEmail,
  create,
  update,
  deleteById,
};
