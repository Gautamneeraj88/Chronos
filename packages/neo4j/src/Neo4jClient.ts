import neo4j, { Driver, Session } from 'neo4j-driver';
import { createLogger } from '@chronos/shared';

const logger = createLogger('neo4j');

export class Neo4jClient {
  private static instance: Neo4jClient;
  private driver: Driver;

  private constructor(uri: string, username: string, password: string) {
    this.driver = neo4j.driver(uri, neo4j.auth.basic(username, password));
  }

  static getInstance(uri?: string, username?: string, password?: string): Neo4jClient {
    if (!Neo4jClient.instance) {
      if (!uri || !username || !password) {
        throw new Error('Neo4jClient config required on first init');
      }
      Neo4jClient.instance = new Neo4jClient(uri, username, password);
    }
    return Neo4jClient.instance;
  }

  getSession(): Session {
    return this.driver.session();
  }

  async verifyConnectivity(): Promise<void> {
    await this.driver.verifyConnectivity();
    logger.info('Neo4j connected');
  }

  async close(): Promise<void> {
    await this.driver.close();
    logger.info('Neo4j disconnected');
  }
}
