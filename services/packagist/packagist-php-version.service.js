import Joi from 'joi'
import { optionalUrl } from '../validators.js'
import { NotFound } from '../index.js'
import {
  allVersionsSchema,
  BasePackagistService,
  customServerDocumentationFragment,
} from './packagist-base.js'

const queryParamSchema = Joi.object({
  server: optionalUrl,
}).required()

export default class PackagistPhpVersion extends BasePackagistService {
  static category = 'platform-support'

  static route = {
    base: 'packagist/php-v',
    pattern: ':user/:repo/:version?',
    queryParamSchema,
  }

  static examples = [
    {
      title: 'Packagist PHP Version Support',
      pattern: ':user/:repo',
      namedParams: {
        user: 'symfony',
        repo: 'symfony',
      },
      staticPreview: this.render({ php: '^7.1.3' }),
    },
    {
      title: 'Packagist PHP Version Support (specify version)',
      pattern: ':user/:repo/:version',
      namedParams: {
        user: 'symfony',
        repo: 'symfony',
        version: 'v2.8.0',
      },
      staticPreview: this.render({ php: '>=5.3.9' }),
    },
    {
      title: 'Packagist PHP Version Support (custom server)',
      pattern: ':user/:repo',
      namedParams: {
        user: 'symfony',
        repo: 'symfony',
      },
      queryParams: {
        server: 'https://packagist.org',
      },
      staticPreview: this.render({ php: '^7.1.3' }),
      documentation: customServerDocumentationFragment,
    },
  ]

  static defaultBadgeData = {
    label: 'php',
    color: 'blue',
  }

  static render({ php }) {
    return {
      message: php,
    }
  }

  findVersionIndex(json, version) {
    return json.findIndex(v => v.version === version)
  }

  async findSpecifiedVersion(json, user, repo, version, server) {
    let release

    if ((release = json[this.findVersionIndex(json, version)])) {
      return release
    } else {
      try {
        const allData = await this.fetchDev({
          user,
          repo,
          schema: allVersionsSchema,
          server,
        })

        const versions = BasePackagistService.expandPackageVersions(
          allData,
          this.getPackageName(user, repo)
        )

        return versions[this.findVersionIndex(versions, version)]
      } catch (e) {
        return release
      }
    }
  }

  async getPhpVersion({ json, user, repo, version = '', server }) {
    let packageVersion
    const versions = BasePackagistService.expandPackageVersions(
      json,
      this.getPackageName(user, repo)
    )

    if (version === '') {
      packageVersion = this.findLatestRelease(versions)
    } else {
      try {
        packageVersion = await this.findSpecifiedVersion(
          versions,
          user,
          repo,
          version,
          server
        )
      } catch (e) {
        packageVersion = null
      }
    }

    if (!packageVersion) {
      throw new NotFound({ prettyMessage: 'invalid version' })
    }

    if (!packageVersion.require || !packageVersion.require.php) {
      throw new NotFound({ prettyMessage: 'version requirement not found' })
    }

    return { phpVersion: packageVersion.require.php }
  }

  async handle({ user, repo, version = '' }, { server }) {
    const allData = await this.fetch({
      user,
      repo,
      schema: allVersionsSchema,
      server,
    })
    const { phpVersion } = await this.getPhpVersion({
      json: allData,
      user,
      repo,
      version,
      server,
    })
    return this.constructor.render({ php: phpVersion })
  }
}
