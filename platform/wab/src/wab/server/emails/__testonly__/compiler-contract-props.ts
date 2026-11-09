export const emailCompilerProps = {
  title: "Compiler email contract",
  projectName: "Compiler email project",
  projectUrl: "https://example.com/projects/email",
  userName: "Email reader",
  mentions: [{ name: "Mention author", link: "https://example.com/mention", commentId: "mention", comment: "Mention **body**" }],
  comments: [{ name: "Comment author", link: "https://example.com/comment", commentId: "comment", comment: "Comment **body**" }],
  replies: [{ rootComment: { id: "root", body: "Original discussion", name: "Root author" }, link: "https://example.com/reply", replies: [{ name: "Reply author", comment: "Reply body" }] }],
  reactions: [{ commentId: "reaction", comment: "Reacted comment", link: "https://example.com/reaction", reactions: [{ name: "Reaction author", emoji: "👍" }] }],
  resolutions: [
    { name: "Resolver", resolved: true, link: "https://example.com/resolved", rootComment: { body: "Resolved discussion", name: "Root author" } },
    { name: "Reopener", resolved: false, link: "https://example.com/reopened", rootComment: { body: "Reopened discussion", name: "Root author" } },
  ],
};
