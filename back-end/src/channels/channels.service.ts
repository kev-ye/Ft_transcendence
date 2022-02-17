import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MessageBody } from '@nestjs/websockets';
import { BanService } from 'src/ban/ban.service';
import { Repository } from 'typeorm';
import { ChannelEntity } from './entity/channels.entity';

@Injectable()
export class ChannelsService {
    constructor(@InjectRepository(ChannelEntity) private repo: Repository<ChannelEntity>) {}

    async getAll() {
        let tmp = await this.repo.find();
        tmp.map(data => {
            data['moderator'] = true;
        });
        return tmp;
        
    }

    async getChannelById(id: string) {
        return await this.repo.findOne({id: id});
    }

    async checkPassword(password: string, chat_id: string) {
        console.log("lol");
        
        const tmp = await this.repo.findOne({id: chat_id});
        if (tmp && tmp.access == 1 && tmp.password)
        {
            //check hashed version of password
            console.log("test password : ", password == tmp.password);
            
            if (password == tmp.password)
                return true;
        }
        return false;
    }

    async updateById(data: any) {
        return await this.repo.update({id: data.id}, data);
    }

    async createChannel(data: any) {
        const result = this.repo.create(data);

        this.repo.save(result);
    }
}