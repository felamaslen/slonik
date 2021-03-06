// @flow

import {
  parse as parseArray,
} from 'postgres-array';
import TypeOverrides from 'pg/lib/type-overrides';
import type {
  InternalDatabaseConnectionType,
  TypeParserType,
} from '../types';

export default async (connection: InternalDatabaseConnectionType, typeParsers: $ReadOnlyArray<TypeParserType>): TypeOverrides => {
  const typeOverrides = new TypeOverrides();

  if (typeParsers.length === 0) {
    return typeOverrides;
  }

  const typeNames = typeParsers.map((typeParser) => {
    return typeParser.name;
  });

  const postgresTypes = (
    await connection.query('SELECT oid, typarray, typname FROM pg_type WHERE typname = ANY($1::text[])', [
      typeNames,
    ])
  ).rows;

  for (const typeParser of typeParsers) {
    const postgresType = postgresTypes.find((maybeTargetPostgresType) => {
      return maybeTargetPostgresType.typname === typeParser.name;
    });

    if (!postgresType) {
      throw new Error('Database type "' + typeParser.name + '" not found.');
    }

    typeOverrides.setTypeParser(postgresType.oid, (value) => {
      return typeParser.parse(value);
    });

    if (postgresType.typarray) {
      typeOverrides.setTypeParser(postgresType.typarray, (arrayValue) => {
        return parseArray(arrayValue)
          .map((value) => {
            return typeParser.parse(value);
          });
      });
    }
  }

  return typeOverrides;
};
