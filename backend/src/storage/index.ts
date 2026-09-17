import { readEnvironment } from '../config/environment.js';
import { AppError } from '../errors/app-error.js';
import { DatabaseStorage } from './databaseStorage.js';
import { LocalDiskStorage } from './localDiskStorage.js';
import type { StorageService } from './types.js';

// Registro de drivers por STORAGE_DRIVER. Acrescentar armazenamento remoto e escrever a classe que
// implementa StorageService e registrar uma linha aqui, sem tocar em controller, servico ou teste.
const driverFactories: Record<string, (uploadDirectory: string) => StorageService> = {
  local: (uploadDirectory) => new LocalDiskStorage(uploadDirectory),
  database: () => new DatabaseStorage(),
};

export function getStorageService(): StorageService {
  const environment = readEnvironment();
  const factory = driverFactories[environment.STORAGE_DRIVER];

  if (!factory) {
    throw new AppError(500, `Driver de armazenamento desconhecido: ${environment.STORAGE_DRIVER}`);
  }

  return factory(environment.UPLOAD_DIR);
}
