// sapdon 的构建入口：登记 bedrock-cui 的界面，然后提交
import { GRegistry, registry } from '@sapdon/core'
import { UISystemRegistry } from '@sapdon/ui'
import { useSapdon } from 'bedrock-cui/node'
import config from './cui.config.mjs'

useSapdon(config, { GRegistry, UISystemRegistry })

registry.submit()
