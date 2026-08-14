import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import '../models/tag_record.dart';

class TagCard extends StatelessWidget {
  final TagRecord tag;
  final VoidCallback onTap;

  const TagCard({super.key, required this.tag, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            AspectRatio(
              aspectRatio: 1,
              child: tag.displayImage.isNotEmpty
                  ? CachedNetworkImage(
                      imageUrl: tag.displayImage,
                      fit: BoxFit.cover,
                      placeholder: (context, url) => Container(color: const Color(0xFFF1EDE4)),
                      errorWidget: (context, url, error) => Container(
                        color: const Color(0xFFF1EDE4),
                        child: const Icon(Icons.checkroom, color: Color(0xFFB9B2A3)),
                      ),
                    )
                  : Container(
                      color: const Color(0xFFF1EDE4),
                      child: const Icon(Icons.checkroom, color: Color(0xFFB9B2A3)),
                    ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(10, 8, 10, 10),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    tag.title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
                  ),
                  if (tag.styleNumber != null || tag.rn != null)
                    Padding(
                      padding: const EdgeInsets.only(top: 2),
                      child: Text(
                        [
                          if (tag.styleNumber != null) '#${tag.styleNumber}',
                          if (tag.rn != null) 'RN ${tag.rn}',
                        ].join(' · '),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontSize: 11, color: Color(0xFF8A8378)),
                      ),
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
